CREATE OR REPLACE FUNCTION public.award_movement_badges(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _b record;
  _prog public.user_movement_progress%ROWTYPE;
  _type text;
  _new int := 0;
  _ok boolean;
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> _user_id
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.coach_owns_patient(_user_id) THEN
    RAISE EXCEPTION 'Not allowed to award movement badges for this user' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _prog FROM public.user_movement_progress WHERE user_id = _user_id;
  IF _prog.user_id IS NULL THEN RETURN 0; END IF;

  FOR _b IN SELECT * FROM public.movement_badges WHERE COALESCE(is_active,true) ORDER BY created_at ASC LOOP
    IF EXISTS (SELECT 1 FROM public.user_movement_badges WHERE user_id=_user_id AND badge_code=_b.code) THEN
      CONTINUE;
    END IF;
    _type := _b.criteria->>'type';
    _ok := false;
    IF _type = 'weeks_completed' THEN
      _ok := COALESCE(_prog.total_weeks_completed,0) >= COALESCE((_b.criteria->>'count')::int, 1);
    ELSIF _type = 'streak' THEN
      _ok := GREATEST(COALESCE(_prog.longest_streak_weeks, 0), COALESCE(_prog.current_streak_weeks, 0)) >= COALESCE((_b.criteria->>'weeks')::int, 1);
    ELSIF _type = 'level_reached' THEN
      _ok := COALESCE(_prog.current_level,1) >= COALESCE((_b.criteria->>'level')::int, 1);
    END IF;
    IF _ok THEN
      INSERT INTO public.user_movement_badges(user_id, badge_code) VALUES (_user_id, _b.code)
      ON CONFLICT DO NOTHING;
      IF FOUND THEN _new := _new + 1; END IF;
    END IF;
  END LOOP;
  RETURN _new;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_movement_progress_for_user(_user_id uuid, _through_day date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _today date := COALESCE(_through_day, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  _program_start date;
  _sub_start timestamptz;
  _profile_created timestamptz;
  _cfg public.movement_config%ROWTYPE;
  _week_start date;
  _week_end date;
  _target int;
  _days_hit int;
  _total_steps int;
  _avg_steps int;
  _status text;
  _completed_count int := 0;
  _missed_count int := 0;
  _current_streak int := 0;
  _longest_streak int := 0;
  _streak_run int := 0;
  _current_level int := 1;
  _level_at_week int := 1;
  _weeks_at_current_level int := 0;
  _weeks_per_level int := 1;
  _min_days int := 7;
  _week_record record;
  _new_badges int := 0;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('updated', false, 'reason', 'missing_user');
  END IF;

  IF auth.uid() IS NOT NULL
     AND auth.uid() <> _user_id
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.coach_owns_patient(_user_id) THEN
    RAISE EXCEPTION 'Not allowed to recompute movement progress for this user' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _cfg
  FROM public.movement_config
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  _weeks_per_level := GREATEST(COALESCE(_cfg.weeks_per_level, 1), 1);
  _min_days := GREATEST(COALESCE(_cfg.min_days_per_week, 7), 1);

  SELECT MIN(COALESCE(started_at, created_at)) INTO _sub_start
  FROM public.subscriptions
  WHERE user_id = _user_id;

  SELECT created_at INTO _profile_created
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1;

  _program_start := COALESCE(_sub_start::date, _profile_created::date, _today);

  INSERT INTO public.user_movement_progress (
    user_id, current_level, weeks_at_current_level, current_streak_weeks,
    longest_streak_weeks, total_weeks_completed, total_weeks_missed
  ) VALUES (_user_id, 1, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  _week_start := _program_start;

  WHILE _week_start + 6 <= _today LOOP
    _level_at_week := _current_level;

    SELECT COALESCE(ml.target_daily_steps, _cfg.base_daily_steps, 5000) INTO _target
    FROM public.movement_levels ml
    WHERE ml.level_number = _level_at_week
    ORDER BY ml.level_number
    LIMIT 1;
    _target := GREATEST(COALESCE(_target, 5000), 500);

    _week_end := _week_start + 6;

    WITH days AS (
      SELECT generate_series(_week_start, _week_end, interval '1 day')::date AS day
    ), daily AS (
      SELECT logged_at::date AS day, MAX(COALESCE(steps_count, 0))::int AS steps
      FROM public.health_logs
      WHERE user_id = _user_id
        AND steps_count IS NOT NULL
        AND logged_at::date BETWEEN _week_start AND _week_end
      GROUP BY logged_at::date
    )
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(daily.steps, 0) >= _target)::int,
      COALESCE(SUM(COALESCE(daily.steps, 0)), 0)::int,
      ROUND(COALESCE(AVG(COALESCE(daily.steps, 0)), 0))::int
    INTO _days_hit, _total_steps, _avg_steps
    FROM days
    LEFT JOIN daily USING (day);

    IF _days_hit >= _min_days THEN
      _status := 'completed';
      _completed_count := _completed_count + 1;
      _streak_run := _streak_run + 1;
      _current_streak := _streak_run;
      _longest_streak := GREATEST(_longest_streak, _streak_run);
      _weeks_at_current_level := _weeks_at_current_level + 1;
      IF _weeks_at_current_level >= _weeks_per_level THEN
        _current_level := LEAST(_current_level + 1, 10);
        _weeks_at_current_level := 0;
      END IF;
    ELSE
      _status := 'missed';
      _missed_count := _missed_count + 1;
      _streak_run := 0;
      _weeks_at_current_level := 0;
      _current_streak := 0;
      IF COALESCE(_cfg.miss_policy, 'hold') = 'reset' THEN
        _current_level := 1;
      ELSIF COALESCE(_cfg.miss_policy, 'hold') = 'demote' THEN
        _current_level := GREATEST(_current_level - 1, 1);
      END IF;
    END IF;

    INSERT INTO public.user_movement_weekly (
      user_id, week_start, level_at_week, target_daily_steps,
      days_hit_target, avg_daily_steps, total_steps, status, finalized_at
    ) VALUES (
      _user_id, _week_start, _level_at_week, _target,
      _days_hit, _avg_steps, _total_steps, _status, now()
    )
    ON CONFLICT (user_id, week_start) DO UPDATE
      SET level_at_week = EXCLUDED.level_at_week,
          target_daily_steps = EXCLUDED.target_daily_steps,
          days_hit_target = EXCLUDED.days_hit_target,
          avg_daily_steps = EXCLUDED.avg_daily_steps,
          total_steps = EXCLUDED.total_steps,
          status = EXCLUDED.status,
          finalized_at = EXCLUDED.finalized_at,
          updated_at = now();

    _week_start := _week_start + 7;
  END LOOP;

  IF _completed_count = 0 AND _missed_count = 0 THEN
    UPDATE public.user_movement_progress
    SET current_level = GREATEST(COALESCE(current_level, 1), 1),
        weeks_at_current_level = COALESCE(weeks_at_current_level, 0),
        current_streak_weeks = 0,
        longest_streak_weeks = COALESCE(longest_streak_weeks, 0),
        total_weeks_completed = 0,
        total_weeks_missed = 0,
        updated_at = now()
    WHERE user_id = _user_id;
  ELSE
    UPDATE public.user_movement_progress
    SET current_level = _current_level,
        weeks_at_current_level = _weeks_at_current_level,
        current_streak_weeks = _current_streak,
        longest_streak_weeks = _longest_streak,
        total_weeks_completed = _completed_count,
        total_weeks_missed = _missed_count,
        updated_at = now()
    WHERE user_id = _user_id;
  END IF;

  _new_badges := public.award_movement_badges(_user_id);

  SELECT * INTO _week_record
  FROM public.user_movement_weekly
  WHERE user_id = _user_id
  ORDER BY week_start DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'updated', true,
    'program_start', _program_start,
    'through_day', _today,
    'completed_weeks', _completed_count,
    'missed_weeks', _missed_count,
    'current_streak_weeks', _current_streak,
    'longest_streak_weeks', _longest_streak,
    'new_badges', _new_badges,
    'latest_week', to_jsonb(_week_record)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_movement_badges(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_movement_badges(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_movement_badges(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_movement_badges(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.recompute_movement_progress_for_user(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_movement_progress_for_user(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.recompute_movement_progress_for_user(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_movement_progress_for_user(uuid, date) TO service_role;

CREATE OR REPLACE FUNCTION public.compute_global_streak_for_user(_user_id uuid, _day date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _d date := COALESCE(_day, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  _cfg public.global_streak_config%ROWTYPE;
  _pillars jsonb; _p jsonb;
  _status jsonb := '{}'::jsonb;
  _all_complete boolean := true;
  _any_required boolean := false;
  _hit boolean; _key text; _required boolean; _threshold numeric;
  _steps int := 0; _weight numeric; _glucose numeric;
  _fasting_hours numeric := 0; _exercise_min int := 0; _yoga_min int := 0; _supp_taken int := 0;
  _streak_row public.user_global_streak%ROWTYPE;
  _new_streak int := 1; _prev_streak int := 0; _prev_date date;
  _snap jsonb;
  _week_start date; _week_end date; _week_num int;
  _month_start date; _month_end date; _month_num int;
  _existing_badge uuid; _b_snap jsonb;
BEGIN
  SELECT * INTO _cfg FROM public.global_streak_config ORDER BY created_at ASC LIMIT 1;
  IF _cfg.id IS NULL THEN
    INSERT INTO public.global_streak_config DEFAULT VALUES RETURNING * INTO _cfg;
  END IF;
  _pillars := _cfg.pillars;

  FOR _p IN SELECT * FROM jsonb_array_elements(_pillars) LOOP
    _key := _p->>'key';
    _required := COALESCE((_p->>'required')::boolean, true);
    _threshold := NULLIF(_p->>'threshold','')::numeric;
    _hit := false;

    IF _key = 'fasting' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.fasting_tracking
        WHERE user_id = _user_id AND date = _d AND COALESCE(fasting_hours_completed,0) > 0
      ) INTO _hit;
      SELECT COALESCE(SUM(fasting_hours_completed),0) INTO _fasting_hours
        FROM public.fasting_tracking WHERE user_id = _user_id AND date = _d;
    ELSIF _key = 'exercise' THEN
      SELECT EXISTS (SELECT 1 FROM public.user_exercise_logs WHERE user_id = _user_id AND logged_at::date = _d) INTO _hit;
      SELECT COALESCE(COUNT(*)*15,0)::int INTO _exercise_min FROM public.user_exercise_logs WHERE user_id = _user_id AND logged_at::date = _d;
    ELSIF _key = 'supplements' THEN
      SELECT EXISTS (SELECT 1 FROM public.user_supplement_tracking WHERE user_id = _user_id AND taken = true AND date = _d) INTO _hit;
      SELECT COUNT(*) INTO _supp_taken FROM public.user_supplement_tracking WHERE user_id = _user_id AND taken = true AND date = _d;
    ELSIF _key = 'steps' THEN
      SELECT COALESCE(MAX(steps_count),0) INTO _steps FROM public.health_logs WHERE user_id = _user_id AND logged_at::date = _d AND steps_count IS NOT NULL;
      _hit := _steps >= COALESCE(_threshold, 6000);
    ELSIF _key = 'diet' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.meal_photos WHERE user_id = _user_id AND created_at::date = _d
        UNION ALL SELECT 1 FROM public.user_plates WHERE user_id = _user_id AND created_at::date = _d
      ) INTO _hit;
    ELSIF _key = 'yoga' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.yoga_booking_instances
        WHERE user_id = _user_id AND status IN ('attended','completed') AND created_at::date = _d
      ) INTO _hit;
      IF _hit THEN _yoga_min := 30; END IF;
    ELSE
      _hit := false;
    END IF;

    _status := _status || jsonb_build_object(_key, jsonb_build_object('hit', _hit, 'required', _required));
    IF _required THEN
      _any_required := true;
      IF NOT _hit THEN _all_complete := false; END IF;
    END IF;
  END LOOP;

  IF NOT _any_required THEN _all_complete := false; END IF;

  SELECT weight INTO _weight FROM public.profiles WHERE user_id = _user_id;
  SELECT glucose_morning INTO _glucose FROM public.health_logs
    WHERE user_id = _user_id AND glucose_morning IS NOT NULL AND logged_at::date <= _d
    ORDER BY logged_at DESC LIMIT 1;

  _snap := jsonb_build_object(
    'weight', _weight, 'glucose', _glucose, 'steps', _steps,
    'fasting_hours', ROUND(_fasting_hours::numeric,1),
    'exercise_min', _exercise_min, 'yoga_min', _yoga_min,
    'supplements_taken', _supp_taken
  );

  INSERT INTO public.user_global_streak_days (user_id, day, pillars_status, all_complete, snapshot)
  VALUES (_user_id, _d, _status, _all_complete, _snap)
  ON CONFLICT (user_id, day) DO UPDATE
    SET pillars_status = EXCLUDED.pillars_status,
        all_complete = EXCLUDED.all_complete,
        snapshot = EXCLUDED.snapshot,
        updated_at = now();

  SELECT * INTO _streak_row FROM public.user_global_streak WHERE user_id = _user_id;
  _prev_streak := COALESCE(_streak_row.current_streak, 0);
  _prev_date := _streak_row.last_complete_date;

  IF _all_complete THEN
    IF _prev_date = _d THEN _new_streak := _prev_streak;
    ELSIF _prev_date = _d - 1 THEN _new_streak := _prev_streak + 1;
    ELSE _new_streak := 1;
    END IF;

    INSERT INTO public.user_global_streak (user_id, current_streak, longest_streak, last_complete_date, total_complete_days)
    VALUES (_user_id, _new_streak, _new_streak, _d, 1)
    ON CONFLICT (user_id) DO UPDATE
      SET current_streak = _new_streak,
          longest_streak = GREATEST(_new_streak, public.user_global_streak.longest_streak),
          last_complete_date = _d,
          total_complete_days = public.user_global_streak.total_complete_days + CASE WHEN _prev_date = _d THEN 0 ELSE 1 END,
          updated_at = now();
  ELSE
    IF _prev_date IS NOT NULL AND _prev_date < _d - 1 THEN
      UPDATE public.user_global_streak SET current_streak = 0, updated_at = now() WHERE user_id = _user_id;
    ELSIF _streak_row.user_id IS NULL THEN
      INSERT INTO public.user_global_streak (user_id, current_streak, longest_streak, total_complete_days)
      VALUES (_user_id, 0, 0, 0) ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'day', _d, 'all_complete', _all_complete, 'pillars', _status, 'snapshot', _snap,
    'current_streak', COALESCE((SELECT current_streak FROM public.user_global_streak WHERE user_id=_user_id), 0)
  );
END;
$function$;

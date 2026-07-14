
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
  _hit boolean; _applicable boolean; _key text; _required boolean; _threshold numeric;

  _yoga_goal int := 20;
  _exercise_goal int := 5;

  _has_fasting_plan boolean := false;
  _has_supp_plan boolean := false;
  _has_yoga_booking boolean := false;
  _has_diabetes boolean := false;

  _movement_target int := 5000;

  _steps int := 0; _weight numeric; _glucose numeric;
  _fasting_hours numeric := 0; _exercise_min int := 0; _yoga_min int := 0; _supp_taken int := 0;
  _water_glasses int := 0;

  _streak_row public.user_global_streak%ROWTYPE;
  _new_streak int := 1; _prev_streak int := 0; _prev_date date;
  _snap jsonb;
BEGIN
  SELECT * INTO _cfg FROM public.global_streak_config ORDER BY created_at ASC LIMIT 1;
  IF _cfg.id IS NULL THEN
    INSERT INTO public.global_streak_config DEFAULT VALUES RETURNING * INTO _cfg;
  END IF;
  _pillars := _cfg.pillars;

  -- app_settings.value is JSONB (numbers stored as JSON numbers)
  SELECT COALESCE((value#>>'{}')::int, 20) INTO _yoga_goal
    FROM public.app_settings WHERE key = 'daily_yoga_minutes';
  SELECT COALESCE((value#>>'{}')::int, 5) INTO _exercise_goal
    FROM public.app_settings WHERE key = 'daily_exercise_goal';

  SELECT EXISTS (SELECT 1 FROM public.user_protocols WHERE user_id = _user_id)
    INTO _has_fasting_plan;
  SELECT EXISTS (SELECT 1 FROM public.user_supplement_plans WHERE user_id = _user_id)
    INTO _has_supp_plan;
  SELECT EXISTS (SELECT 1 FROM public.yoga_bookings WHERE user_id = _user_id)
    INTO _has_yoga_booking;
  SELECT COALESCE((clinical->>'hasDiabetes')::boolean, false) INTO _has_diabetes
    FROM public.profiles WHERE id = _user_id;

  SELECT COALESCE(ml.target_daily_steps, 5000) INTO _movement_target
    FROM public.user_movement_progress ump
    LEFT JOIN public.movement_levels ml ON ml.level_number = ump.current_level
    WHERE ump.user_id = _user_id
    LIMIT 1;
  IF _movement_target IS NULL OR _movement_target <= 0 THEN _movement_target := 5000; END IF;

  SELECT COALESCE(SUM(fasting_hours_completed),0) INTO _fasting_hours
    FROM public.fasting_tracking WHERE user_id = _user_id AND date = _d;
  SELECT COALESCE(MAX(steps_count),0) INTO _steps
    FROM public.health_logs
    WHERE user_id = _user_id AND logged_at::date = _d AND steps_count IS NOT NULL;
  SELECT COUNT(*)::int INTO _water_glasses
    FROM public.health_logs
    WHERE user_id = _user_id AND log_type = 'water' AND logged_at::date = _d;
  SELECT COUNT(*)::int * 15 INTO _exercise_min
    FROM public.user_exercise_logs WHERE user_id = _user_id AND logged_at::date = _d;
  SELECT COUNT(*)::int INTO _supp_taken
    FROM public.user_supplement_tracking
    WHERE user_id = _user_id AND taken = true AND date = _d;

  FOR _p IN SELECT * FROM jsonb_array_elements(_pillars) LOOP
    _key := _p->>'key';
    _required := COALESCE((_p->>'required')::boolean, true);
    _threshold := NULLIF(_p->>'threshold','')::numeric;
    _hit := false;
    _applicable := true;

    IF _key = 'fasting' THEN
      _applicable := _has_fasting_plan;
      IF _applicable THEN
        SELECT EXISTS (
          SELECT 1 FROM public.fasting_tracking
          WHERE user_id = _user_id AND date = _d
            AND (
              compliance_status IN ('completed','partial')
              OR (fmod_actual_time IS NOT NULL AND lmod_actual_time IS NOT NULL)
              OR COALESCE(fasting_hours_completed,0) > 0
            )
        ) INTO _hit;
      END IF;

    ELSIF _key = 'supplements' THEN
      _applicable := _has_supp_plan;
      IF _applicable THEN
        SELECT (
          _supp_taken > 0 AND _supp_taken >= (
            SELECT COALESCE(COUNT(*),0)
            FROM public.user_supplement_plan_items pi
            JOIN public.user_supplement_plans pl ON pl.id = pi.plan_id
            WHERE pl.user_id = _user_id
          )
        ) INTO _hit;
      END IF;

    ELSIF _key = 'movement' THEN
      _hit := _steps >= _movement_target;

    ELSIF _key = 'exercise' THEN
      SELECT (COUNT(*) >= _exercise_goal) INTO _hit
        FROM public.user_exercise_logs
        WHERE user_id = _user_id AND logged_at::date = _d;

    ELSIF _key = 'yoga' THEN
      _applicable := _has_yoga_booking;
      IF _applicable THEN
        _yoga_min := 0;
        SELECT EXISTS (
          SELECT 1 FROM public.yoga_booking_instances
          WHERE user_id = _user_id AND status IN ('attended','completed')
            AND (scheduled_date = _d OR created_at::date = _d)
        ) INTO _hit;
        IF NOT _hit THEN
          SELECT COALESCE(FLOOR(SUM(LEAST(COALESCE(progress_sec,0), COALESCE(duration_sec, progress_sec)))/60),0)::int
            INTO _yoga_min
            FROM public.video_progress
            WHERE user_id = _user_id AND watched_at::date = _d;
          IF _yoga_min >= _yoga_goal THEN _hit := true; END IF;
        END IF;
      END IF;

    ELSIF _key = 'water' THEN
      _hit := _water_glasses >= COALESCE(_threshold, 8);

    ELSIF _key = 'diabetes' THEN
      _applicable := _has_diabetes;
      IF _applicable THEN
        SELECT EXISTS (
          SELECT 1 FROM public.health_logs
          WHERE user_id = _user_id AND log_type = 'diabetes' AND logged_at::date = _d
        ) INTO _hit;
      END IF;
    END IF;

    _status := _status || jsonb_build_object(
      _key, jsonb_build_object('hit', _hit, 'required', _required, 'applicable', _applicable)
    );

    IF _applicable AND _required AND NOT _hit THEN
      _all_complete := false;
    END IF;
  END LOOP;

  SELECT weight_kg INTO _weight FROM public.health_logs
    WHERE user_id = _user_id AND weight_kg IS NOT NULL AND logged_at::date <= _d
    ORDER BY logged_at DESC LIMIT 1;
  SELECT glucose_morning INTO _glucose FROM public.health_logs
    WHERE user_id = _user_id AND glucose_morning IS NOT NULL AND logged_at::date <= _d
    ORDER BY logged_at DESC LIMIT 1;

  _snap := jsonb_build_object(
    'weight', _weight, 'glucose', _glucose, 'steps', _steps,
    'fasting_hours', ROUND(_fasting_hours::numeric,1),
    'exercise_min', _exercise_min, 'yoga_min', _yoga_min,
    'supplements_taken', _supp_taken, 'water_glasses', _water_glasses,
    'movement_target', _movement_target
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


-- ============================================================
-- 1. HELPER: compute streak of consecutive compliant days from a date-set
-- ============================================================
CREATE OR REPLACE FUNCTION public.streak_from_dates(_dates date[], _today date)
RETURNS TABLE(current_streak int, longest_streak int)
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _sorted date[];
  _cur int := 0;
  _max int := 0;
  _prev date;
  _d date;
BEGIN
  IF _dates IS NULL OR array_length(_dates, 1) IS NULL THEN
    RETURN QUERY SELECT 0, 0; RETURN;
  END IF;
  SELECT array_agg(x ORDER BY x) INTO _sorted FROM (SELECT DISTINCT unnest(_dates) x) s;

  -- longest
  _prev := NULL;
  FOREACH _d IN ARRAY _sorted LOOP
    IF _prev IS NOT NULL AND _d = _prev + 1 THEN _cur := _cur + 1;
    ELSE _cur := 1; END IF;
    IF _cur > _max THEN _max := _cur; END IF;
    _prev := _d;
  END LOOP;

  -- current: walk back from today (or yesterday if today missing)
  _cur := 0;
  _d := CASE WHEN _today = ANY(_sorted) THEN _today ELSE _today - 1 END;
  WHILE _d = ANY(_sorted) LOOP
    _cur := _cur + 1;
    _d := _d - 1;
  END LOOP;

  RETURN QUERY SELECT _cur, _max;
END;
$$;

-- ============================================================
-- 2. AWARD FASTING BADGES
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_fasting_badges(_user_id uuid)
RETURNS TABLE(current_streak int, longest_streak int, newly_awarded int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _dates date[];
  _cur int; _lng int;
  _b record;
  _new int := 0;
BEGIN
  SELECT array_agg(DISTINCT date) INTO _dates
  FROM public.fasting_tracking
  WHERE user_id = _user_id
    AND (compliance_status IN ('completed','partial')
         OR (fmod_actual_time IS NOT NULL AND lmod_actual_time IS NOT NULL)
         OR COALESCE(fasting_hours_completed,0) > 0);

  SELECT s.current_streak, s.longest_streak INTO _cur, _lng
  FROM public.streak_from_dates(_dates, _today) s;
  _cur := COALESCE(_cur,0); _lng := COALESCE(_lng,0);

  FOR _b IN SELECT * FROM public.fasting_badges ORDER BY level LOOP
    IF _lng >= _b.required_streak_days
       AND NOT EXISTS (SELECT 1 FROM public.user_fasting_badges
                       WHERE user_id=_user_id AND badge_id=_b.id) THEN
      INSERT INTO public.user_fasting_badges(user_id, badge_id, current_streak, longest_streak)
      VALUES (_user_id, _b.id, _cur, _lng);
      _new := _new + 1;
    END IF;
  END LOOP;

  UPDATE public.user_fasting_badges
    SET current_streak = _cur, longest_streak = _lng
  WHERE user_id = _user_id;

  RETURN QUERY SELECT _cur, _lng, _new;
END;
$$;

-- ============================================================
-- 3. AWARD SUPPLEMENT BADGES
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_supplement_badges(_user_id uuid)
RETURNS TABLE(current_streak int, longest_streak int, newly_awarded int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _active int;
  _dates date[];
  _cur int; _lng int;
  _b record;
  _new int := 0;
BEGIN
  SELECT COUNT(*)::int INTO _active
  FROM public.user_supplement_plan_items pi
  JOIN public.user_supplement_plans pl ON pl.id = pi.plan_id
  WHERE pl.user_id = _user_id AND COALESCE(pi.is_active,true) AND COALESCE(pl.status,'active') = 'active';

  IF _active > 0 THEN
    SELECT array_agg(date) INTO _dates FROM (
      SELECT date FROM public.user_supplement_tracking
      WHERE user_id = _user_id AND taken = true
      GROUP BY date HAVING COUNT(*) >= _active
    ) d;
  ELSE
    SELECT array_agg(DISTINCT date) INTO _dates
    FROM public.user_supplement_tracking
    WHERE user_id = _user_id AND taken = true;
  END IF;

  SELECT s.current_streak, s.longest_streak INTO _cur, _lng
  FROM public.streak_from_dates(_dates, _today) s;
  _cur := COALESCE(_cur,0); _lng := COALESCE(_lng,0);

  FOR _b IN SELECT * FROM public.supplement_badges ORDER BY level LOOP
    IF _lng >= _b.required_streak_days
       AND NOT EXISTS (SELECT 1 FROM public.user_supplement_badges
                       WHERE user_id=_user_id AND badge_id=_b.id) THEN
      INSERT INTO public.user_supplement_badges(user_id, badge_id, current_streak, longest_streak)
      VALUES (_user_id, _b.id, _cur, _lng);
      _new := _new + 1;
    END IF;
  END LOOP;

  UPDATE public.user_supplement_badges
    SET current_streak = _cur, longest_streak = _lng
  WHERE user_id = _user_id;

  RETURN QUERY SELECT _cur, _lng, _new;
END;
$$;

-- ============================================================
-- 4. AWARD EXERCISE BADGES (completion counts by category/plan)
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_exercise_badges(_user_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _b record; _completions int; _slug text; _plan text; _need int;
  _new int := 0;
BEGIN
  FOR _b IN SELECT * FROM public.exercise_badges WHERE COALESCE(enabled,true) LOOP
    IF EXISTS (SELECT 1 FROM public.user_exercise_badges WHERE user_id=_user_id AND badge_key=_b.key) THEN
      CONTINUE;
    END IF;
    _need := COALESCE((_b.criteria_json->>'required_completions')::int, 5);
    _slug := _b.criteria_json->>'category_slug';

    IF _slug IS NULL THEN
      SELECT COUNT(*)::int INTO _completions
      FROM public.user_exercise_logs WHERE user_id = _user_id;
    ELSE
      SELECT COUNT(*)::int INTO _completions
      FROM public.user_exercise_logs el
      JOIN public.exercises ex ON ex.id = el.exercise_id
      JOIN public.exercise_categories ec ON ec.id = ex.category_id
      WHERE el.user_id = _user_id AND ec.slug = _slug;
    END IF;

    IF _completions >= _need THEN
      INSERT INTO public.user_exercise_badges(user_id, badge_key)
      VALUES (_user_id, _b.key)
      ON CONFLICT DO NOTHING;
      _new := _new + 1;
    END IF;
  END LOOP;
  RETURN _new;
END;
$$;

-- ============================================================
-- 5. AWARD MOVEMENT BADGES (weeks / level based)
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_movement_badges(_user_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _b record; _prog public.user_movement_progress%ROWTYPE;
  _type text; _new int := 0; _ok boolean;
BEGIN
  SELECT * INTO _prog FROM public.user_movement_progress WHERE user_id = _user_id;
  IF _prog.user_id IS NULL THEN RETURN 0; END IF;

  FOR _b IN SELECT * FROM public.movement_badges WHERE COALESCE(is_active,true) LOOP
    IF EXISTS (SELECT 1 FROM public.user_movement_badges WHERE user_id=_user_id AND badge_code=_b.code) THEN
      CONTINUE;
    END IF;
    _type := _b.criteria->>'type';
    _ok := false;
    IF _type = 'weeks_completed' THEN
      _ok := COALESCE(_prog.total_weeks_completed,0) >= COALESCE((_b.criteria->>'count')::int, 1);
    ELSIF _type = 'streak' THEN
      _ok := COALESCE(_prog.longest_streak_weeks, _prog.current_streak_weeks, 0) >= COALESCE((_b.criteria->>'weeks')::int, 1);
    ELSIF _type = 'level_reached' THEN
      _ok := COALESCE(_prog.current_level,1) >= COALESCE((_b.criteria->>'level')::int, 1);
    END IF;
    IF _ok THEN
      INSERT INTO public.user_movement_badges(user_id, badge_code) VALUES (_user_id, _b.code)
      ON CONFLICT DO NOTHING;
      _new := _new + 1;
    END IF;
  END LOOP;
  RETURN _new;
END;
$$;

-- ============================================================
-- 6. BUILD BBDO SNAPSHOT: real health deltas + activity totals
-- ============================================================
CREATE OR REPLACE FUNCTION public.build_bbdo_snapshot(_user_id uuid, _start date, _end date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _w_start numeric; _w_end numeric;
  _g_start numeric; _g_end numeric;
  _sys_start numeric; _sys_end numeric;
  _dia_start numeric; _dia_end numeric;
  _steps int := 0; _water numeric := 0; _ex_min int := 0;
  _yoga_min int := 0; _supp int := 0; _fast_hrs numeric := 0;
  _complete_days int := 0;
BEGIN
  -- weight: first & last in window (fallback to baseline)
  SELECT weight_kg INTO _w_start FROM public.health_logs
    WHERE user_id=_user_id AND log_type='weight' AND weight_kg IS NOT NULL
      AND logged_at::date >= _start AND logged_at::date <= _end
    ORDER BY logged_at ASC LIMIT 1;
  SELECT weight_kg INTO _w_end FROM public.health_logs
    WHERE user_id=_user_id AND log_type='weight' AND weight_kg IS NOT NULL
      AND logged_at::date >= _start AND logged_at::date <= _end
    ORDER BY logged_at DESC LIMIT 1;

  -- glucose morning
  SELECT glucose_morning INTO _g_start FROM public.health_logs
    WHERE user_id=_user_id AND log_type='diabetes' AND glucose_morning IS NOT NULL
      AND logged_at::date >= _start AND logged_at::date <= _end
    ORDER BY logged_at ASC LIMIT 1;
  SELECT glucose_morning INTO _g_end FROM public.health_logs
    WHERE user_id=_user_id AND log_type='diabetes' AND glucose_morning IS NOT NULL
      AND logged_at::date >= _start AND logged_at::date <= _end
    ORDER BY logged_at DESC LIMIT 1;

  -- BP
  SELECT bp_systolic, bp_diastolic INTO _sys_start, _dia_start FROM public.health_logs
    WHERE user_id=_user_id AND log_type='bp' AND bp_systolic IS NOT NULL
      AND logged_at::date >= _start AND logged_at::date <= _end
    ORDER BY logged_at ASC LIMIT 1;
  SELECT bp_systolic, bp_diastolic INTO _sys_end, _dia_end FROM public.health_logs
    WHERE user_id=_user_id AND log_type='bp' AND bp_systolic IS NOT NULL
      AND logged_at::date >= _start AND logged_at::date <= _end
    ORDER BY logged_at DESC LIMIT 1;

  -- Aggregates from user_global_streak_days snapshot
  SELECT
    COALESCE(SUM((snapshot->>'steps')::int),0),
    COALESCE(SUM((snapshot->>'water_glasses')::numeric),0),
    COALESCE(SUM((snapshot->>'exercise_completed')::int),0)*15,
    COALESCE(SUM((snapshot->>'yoga_min')::int),0),
    COALESCE(SUM((snapshot->>'supp_taken')::int),0),
    COALESCE(SUM((snapshot->>'fasting_hours')::numeric),0),
    COALESCE(SUM(CASE WHEN all_complete THEN 1 ELSE 0 END),0)
  INTO _steps,_water,_ex_min,_yoga_min,_supp,_fast_hrs,_complete_days
  FROM public.user_global_streak_days
  WHERE user_id=_user_id AND day BETWEEN _start AND _end;

  RETURN jsonb_build_object(
    'weight_start', _w_start, 'weight_end', _w_end,
    'glucose_start', _g_start, 'glucose_end', _g_end,
    'bp_systolic_start', _sys_start, 'bp_systolic_end', _sys_end,
    'bp_diastolic_start', _dia_start, 'bp_diastolic_end', _dia_end,
    'total_steps', _steps,
    'total_water_glasses', _water,
    'total_exercise_min', _ex_min,
    'total_yoga_min', _yoga_min,
    'total_supplements', _supp,
    'total_fasting_hours', _fast_hrs,
    'complete_days', _complete_days
  );
END;
$$;

-- ============================================================
-- 7. ISSUE BBDO BADGES if user has 7 / 28 consecutive complete days ending _day
-- ============================================================
CREATE OR REPLACE FUNCTION public.issue_bbdo_badges_for_user(_user_id uuid, _day date DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _end date := COALESCE(_day, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  _week_start date := _end - 6;
  _month_start date := _end - 27;
  _week_complete int; _month_complete int;
  _period_num int; _snap jsonb; _new int := 0;
BEGIN
  SELECT COUNT(*)::int INTO _week_complete
  FROM public.user_global_streak_days
  WHERE user_id=_user_id AND day BETWEEN _week_start AND _end AND all_complete = true;

  IF _week_complete = 7 THEN
    SELECT COALESCE(MAX(period_number),0)+1 INTO _period_num
    FROM public.user_bbdo_badges WHERE user_id=_user_id AND badge_type='weekly';
    _snap := public.build_bbdo_snapshot(_user_id, _week_start, _end);
    INSERT INTO public.user_bbdo_badges(user_id, badge_type, period_start, period_end, period_number, snapshot, viewed)
    VALUES (_user_id, 'weekly', _week_start, _end, _period_num, _snap, false)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN _new := _new + 1; END IF;
  END IF;

  SELECT COUNT(*)::int INTO _month_complete
  FROM public.user_global_streak_days
  WHERE user_id=_user_id AND day BETWEEN _month_start AND _end AND all_complete = true;

  IF _month_complete = 28 THEN
    SELECT COALESCE(MAX(period_number),0)+1 INTO _period_num
    FROM public.user_bbdo_badges WHERE user_id=_user_id AND badge_type='monthly';
    _snap := public.build_bbdo_snapshot(_user_id, _month_start, _end);
    INSERT INTO public.user_bbdo_badges(user_id, badge_type, period_start, period_end, period_number, snapshot, viewed)
    VALUES (_user_id, 'monthly', _month_start, _end, _period_num, _snap, false)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN _new := _new + 1; END IF;
  END IF;

  RETURN _new;
END;
$$;

-- Add unique index so ON CONFLICT works for BBDO badges (one per period per user per type)
CREATE UNIQUE INDEX IF NOT EXISTS user_bbdo_badges_unique_period
  ON public.user_bbdo_badges(user_id, badge_type, period_start, period_end);

-- ============================================================
-- 8. Unified refresh: recompute streak day + award all pillar badges + BBDO
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_gamification_for_user(_user_id uuid, _day date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _d date := COALESCE(_day, (now() AT TIME ZONE 'Asia/Kolkata')::date);
BEGIN
  PERFORM public.compute_global_streak_for_user(_user_id, _d);
  PERFORM public.award_fasting_badges(_user_id);
  PERFORM public.award_supplement_badges(_user_id);
  PERFORM public.award_exercise_badges(_user_id);
  PERFORM public.award_movement_badges(_user_id);
  PERFORM public.issue_bbdo_badges_for_user(_user_id, _d);
END;
$$;

-- ============================================================
-- 9. Daily cron entry-point: close YESTERDAY for every active user
-- ============================================================
CREATE OR REPLACE FUNCTION public.run_daily_gamification_close()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _yesterday date := ((now() AT TIME ZONE 'Asia/Kolkata')::date) - 1;
  _uid uuid;
  _count int := 0;
BEGIN
  FOR _uid IN
    SELECT DISTINCT user_id FROM public.subscriptions
    WHERE status='active' AND expires_at > now()
  LOOP
    BEGIN
      PERFORM public.refresh_gamification_for_user(_uid, _yesterday);
      _count := _count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- keep going; one user shouldn't break the batch
      NULL;
    END;
  END LOOP;
  RETURN _count;
END;
$$;

-- ============================================================
-- 10. TRIGGERS: refresh on any log/tracking activity
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_refresh_gamification()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _d date;
BEGIN
  _uid := COALESCE(NEW.user_id, OLD.user_id);
  IF _uid IS NULL THEN RETURN COALESCE(NEW,OLD); END IF;

  -- prefer row's date if it has one, else today
  _d := CASE
    WHEN TG_TABLE_NAME='fasting_tracking' THEN NEW.date
    WHEN TG_TABLE_NAME='user_supplement_tracking' THEN NEW.date
    WHEN TG_TABLE_NAME='user_exercise_logs' THEN NEW.logged_at::date
    WHEN TG_TABLE_NAME='health_logs' THEN NEW.logged_at::date
    WHEN TG_TABLE_NAME='user_movement_weekly' THEN NEW.week_start
    ELSE (now() AT TIME ZONE 'Asia/Kolkata')::date
  END;

  PERFORM public.refresh_gamification_for_user(_uid, _d);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_gamification_fasting ON public.fasting_tracking;
CREATE TRIGGER refresh_gamification_fasting
  AFTER INSERT OR UPDATE ON public.fasting_tracking
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_gamification();

DROP TRIGGER IF EXISTS refresh_gamification_supp ON public.user_supplement_tracking;
CREATE TRIGGER refresh_gamification_supp
  AFTER INSERT OR UPDATE ON public.user_supplement_tracking
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_gamification();

DROP TRIGGER IF EXISTS refresh_gamification_exercise ON public.user_exercise_logs;
CREATE TRIGGER refresh_gamification_exercise
  AFTER INSERT ON public.user_exercise_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_gamification();

DROP TRIGGER IF EXISTS refresh_gamification_health ON public.health_logs;
CREATE TRIGGER refresh_gamification_health
  AFTER INSERT ON public.health_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_gamification();

DROP TRIGGER IF EXISTS refresh_gamification_movement_weekly ON public.user_movement_weekly;
CREATE TRIGGER refresh_gamification_movement_weekly
  AFTER INSERT OR UPDATE ON public.user_movement_weekly
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_gamification();

-- Grants
GRANT EXECUTE ON FUNCTION public.award_fasting_badges(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.award_supplement_badges(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.award_exercise_badges(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.award_movement_badges(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.build_bbdo_snapshot(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.issue_bbdo_badges_for_user(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_gamification_for_user(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_daily_gamification_close() TO service_role;

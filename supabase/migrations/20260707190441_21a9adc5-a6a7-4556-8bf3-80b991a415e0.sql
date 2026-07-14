
-- Weekly Progress: always record a card for every completed calendar week,
-- regardless of how many days were fully complete. Monthly stays gated at 28.
CREATE OR REPLACE FUNCTION public.issue_bbdo_badges_for_user(_user_id uuid, _day date DEFAULT NULL::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _end date := COALESCE(_day, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  _week_start date := _end - 6;
  _month_start date := _end - 27;
  _month_complete int;
  _period_num int; _snap jsonb; _new int := 0;
  _has_activity boolean;
BEGIN
  -- WEEKLY: always insert a progress card if there's any tracked activity in the window
  SELECT EXISTS(
    SELECT 1 FROM public.user_global_streak_days
    WHERE user_id=_user_id AND day BETWEEN _week_start AND _end
  ) INTO _has_activity;

  IF _has_activity THEN
    SELECT COALESCE(MAX(period_number),0)+1 INTO _period_num
    FROM public.user_bbdo_badges WHERE user_id=_user_id AND badge_type='weekly';
    _snap := public.build_bbdo_snapshot(_user_id, _week_start, _end);
    INSERT INTO public.user_bbdo_badges(user_id, badge_type, period_start, period_end, period_number, snapshot, viewed)
    VALUES (_user_id, 'weekly', _week_start, _end, _period_num, _snap, false)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN _new := _new + 1; END IF;
  END IF;

  -- MONTHLY: still gated at 28 fully-complete days
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
$function$;

-- Backfill Week 1 for the test user, keep Week 2 as-is (period_number=2 stands)
DO $$
DECLARE
  _uid uuid := 'aedb50d4-7db9-426e-86cc-826ec57bccfa';
  _snap jsonb;
BEGIN
  _snap := public.build_bbdo_snapshot(_uid, DATE '2026-06-25', DATE '2026-07-01');
  INSERT INTO public.user_bbdo_badges(user_id, badge_type, period_start, period_end, period_number, snapshot, viewed)
  VALUES (_uid, 'weekly', DATE '2026-06-25', DATE '2026-07-01', 1, _snap, true)
  ON CONFLICT (user_id, badge_type, period_start) DO UPDATE
    SET period_number = 1, snapshot = EXCLUDED.snapshot;
END $$;


-- Fix: only issue a weekly BBDO badge when the user actually completes a full 7-day program week.
-- Previously the function issued a badge whenever there was any activity in the trailing 7 days,
-- which caused first-time login popups showing a "1-week journey" summary for users who had just signed up.

CREATE OR REPLACE FUNCTION public.issue_bbdo_badges_for_user(_user_id uuid, _day date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _end date := COALESCE(_day, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  _program_start date;
  _elapsed int;
  _week_start date;
  _month_start date := _end - 27;
  _month_complete int;
  _period_num int; _snap jsonb; _new int := 0;
  _sub_start timestamptz;
  _profile_created timestamptz;
BEGIN
  -- Determine the user's program start date (subscription first, else profile created)
  SELECT MIN(COALESCE(started_at, created_at)) INTO _sub_start
  FROM public.subscriptions WHERE user_id = _user_id;

  IF _sub_start IS NULL THEN
    SELECT created_at INTO _profile_created FROM public.profiles WHERE user_id = _user_id LIMIT 1;
    _program_start := COALESCE(_profile_created::date, _end);
  ELSE
    _program_start := _sub_start::date;
  END IF;

  _elapsed := _end - _program_start;

  -- WEEKLY: only when a full 7-day program week has just ended
  IF _elapsed >= 6 AND (_elapsed % 7) = 6 THEN
    _week_start := _end - 6;
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

-- Clean up wrongly-issued weekly badges: any weekly badge whose period_end is before the user
-- had actually completed 7 days on the program is invalid. Delete only unviewed ones so we don't
-- rewrite user history for already-seen popups.
DELETE FROM public.user_bbdo_badges b
USING (
  SELECT b2.id
  FROM public.user_bbdo_badges b2
  LEFT JOIN LATERAL (
    SELECT MIN(COALESCE(s.started_at, s.created_at))::date AS program_start
    FROM public.subscriptions s WHERE s.user_id = b2.user_id
  ) sub ON true
  LEFT JOIN public.profiles p ON p.user_id = b2.user_id
  WHERE b2.badge_type = 'weekly'
    AND b2.viewed = false
    AND (
      (b2.period_end - COALESCE(sub.program_start, p.created_at::date)) < 6
      OR ((b2.period_end - COALESCE(sub.program_start, p.created_at::date)) % 7) <> 6
    )
) invalid
WHERE b.id = invalid.id;

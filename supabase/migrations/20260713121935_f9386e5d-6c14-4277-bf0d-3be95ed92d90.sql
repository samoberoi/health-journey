
-- Exercise badges: rewrite to award only on distinct days of qualifying practice,
-- gated by tier, plan_key and category. Cap at 1 new badge per calendar day.

CREATE OR REPLACE FUNCTION public.award_exercise_badges(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _b record;
  _distinct_days int;
  _need int;
  _slug text;
  _plan text;
  _new int := 0;
  _today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _already_today int;
  _user_tier int;
BEGIN
  -- Derive the user's active tier from their subscription plan.
  SELECT CASE
           WHEN s.plan_id = 'intensive' OR s.plan_id = 'pro' THEN 3
           WHEN s.plan_id = 'active' THEN 2
           ELSE 1
         END
    INTO _user_tier
  FROM public.subscriptions s
  WHERE s.user_id = _user_id AND s.status = 'active'
  ORDER BY s.started_at DESC NULLS LAST
  LIMIT 1;
  _user_tier := COALESCE(_user_tier, 1);

  -- Rate-limit: only one new badge per day per user (mirrors fasting cadence).
  SELECT COUNT(*)::int INTO _already_today
  FROM public.user_exercise_badges
  WHERE user_id = _user_id
    AND (earned_at AT TIME ZONE 'Asia/Kolkata')::date = _today;

  IF _already_today > 0 THEN
    RETURN 0;
  END IF;

  FOR _b IN
    SELECT * FROM public.exercise_badges
    WHERE COALESCE(enabled, true)
      AND tier_required <= _user_tier
    ORDER BY tier_required ASC, key ASC
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.user_exercise_badges
      WHERE user_id = _user_id AND badge_key = _b.key
    ) THEN
      CONTINUE;
    END IF;

    _need := COALESCE((_b.criteria_json->>'required_completions')::int, 5);
    _slug := _b.criteria_json->>'category_slug';
    _plan := _b.criteria_json->>'plan_key';

    -- Count DISTINCT calendar days on which the user completed a qualifying
    -- exercise (matching plan_key and, if set, category_slug). Days-based
    -- prevents same-day bulk unlocks.
    SELECT COUNT(DISTINCT (el.logged_at AT TIME ZONE 'Asia/Kolkata')::date)::int
      INTO _distinct_days
    FROM public.user_exercise_logs el
    JOIN public.exercises ex ON ex.id = el.exercise_id
    LEFT JOIN public.exercise_categories ec ON ec.id = ex.category_id
    WHERE el.user_id = _user_id
      AND (_plan IS NULL OR ex.plan_key = _plan)
      AND (_slug IS NULL OR ec.slug = _slug);

    IF _distinct_days >= _need THEN
      INSERT INTO public.user_exercise_badges(user_id, badge_key)
      VALUES (_user_id, _b.key)
      ON CONFLICT DO NOTHING;
      _new := _new + 1;
      -- One badge per day: stop after the first award this call.
      EXIT;
    END IF;
  END LOOP;

  RETURN _new;
END;
$function$;

-- Reset wrongly-awarded exercise badges so the new rule applies from scratch.
DELETE FROM public.user_exercise_badges;

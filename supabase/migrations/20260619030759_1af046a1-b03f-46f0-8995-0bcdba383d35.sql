
-- Migrate any coach still on the legacy starter_reset type to active_reset
UPDATE public.coaches
SET coach_type = 'active_reset'::coach_type
WHERE coach_type = 'starter_reset'::coach_type;

-- Replace coach-assignment function to map by package plan_key
CREATE OR REPLACE FUNCTION public.assign_coach_for_plan(_user_id uuid, _plan_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _coach_type coach_type;
  _coach_id UUID;
BEGIN
  -- Foundation package: no coach is assigned
  IF _plan_id IN ('foundation', 'starter') THEN
    UPDATE public.coach_assignments SET is_active = false
     WHERE user_id = _user_id AND is_active = true;
    UPDATE public.profiles SET coach_name = NULL WHERE user_id = _user_id;
    RETURN NULL;
  END IF;

  -- Map package plan_key to coach_type
  _coach_type := CASE _plan_id
    WHEN 'active' THEN 'active_reset'::coach_type
    WHEN 'intensive' THEN 'pro_transformation'::coach_type
    WHEN 'pro' THEN 'pro_transformation'::coach_type
    ELSE 'active_reset'::coach_type
  END;

  -- Deactivate existing assignments
  UPDATE public.coach_assignments SET is_active = false
   WHERE user_id = _user_id AND is_active = true;

  -- Pick coach with fewest active assignments (load balancing)
  SELECT c.id INTO _coach_id
  FROM public.coaches c
  LEFT JOIN (
    SELECT coach_id, COUNT(*) AS cnt
    FROM public.coach_assignments
    WHERE is_active = true
    GROUP BY coach_id
  ) a ON a.coach_id = c.id
  WHERE c.coach_type = _coach_type
    AND c.is_active = true
  ORDER BY COALESCE(a.cnt, 0) ASC, c.avg_rating DESC
  LIMIT 1;

  IF _coach_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.coach_assignments (user_id, coach_id, is_active)
  VALUES (_user_id, _coach_id, true)
  ON CONFLICT (user_id, coach_id) DO UPDATE SET is_active = true, assigned_at = now();

  UPDATE public.profiles
     SET coach_name = (SELECT name FROM public.coaches WHERE id = _coach_id)
   WHERE user_id = _user_id;

  RETURN _coach_id;
END;
$function$;

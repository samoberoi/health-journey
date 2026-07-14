
-- Fix infinite recursion between coaches and coach_assignments RLS policies
-- by routing the cross-table checks through SECURITY DEFINER functions.

CREATE OR REPLACE FUNCTION public.is_coach_of_assignment(_coach_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coaches c
    WHERE c.id = _coach_id AND c.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_patient_of_coach(_coach_row_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_assignments ca
    WHERE ca.coach_id = _coach_row_id
      AND ca.user_id = auth.uid()
      AND ca.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.coach_owns_patient(_patient_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_assignments ca
    JOIN public.coaches c ON c.id = ca.coach_id
    WHERE ca.user_id = _patient_user_id
      AND ca.is_active = true
      AND c.user_id = auth.uid()
  );
$$;

-- coach_assignments: replace recursive policy
DROP POLICY IF EXISTS "Coaches can view their assignments" ON public.coach_assignments;
CREATE POLICY "Coaches can view their assignments"
ON public.coach_assignments
FOR SELECT
USING (public.is_coach_of_assignment(coach_id));

-- coaches: replace recursive policy
DROP POLICY IF EXISTS "Assigned patients can view their coach" ON public.coaches;
CREATE POLICY "Assigned patients can view their coach"
ON public.coaches
FOR SELECT
USING (is_active = true AND public.is_assigned_patient_of_coach(id));

-- user_diet_profiles: replace cross-table policy with definer function (defensive)
DROP POLICY IF EXISTS "Coaches can view patient diet profiles" ON public.user_diet_profiles;
CREATE POLICY "Coaches can view patient diet profiles"
ON public.user_diet_profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'coach'::app_role) AND public.coach_owns_patient(user_id));

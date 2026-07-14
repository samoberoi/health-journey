
-- Fix #1: Restrict app_settings SELECT to admins; expose markup via SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;

CREATE POLICY "Admins can read app settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_lab_test_markup_pct()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF((value)::text, '')::numeric::integer,
    25
  )
  FROM public.app_settings
  WHERE key = 'lab_test_markup_pct'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_lab_test_markup_pct() TO anon, authenticated;

-- Fix #3: Remove user self-insert into coach_assignments (server-side functions handle this)
DROP POLICY IF EXISTS "System can insert assignments" ON public.coach_assignments;

-- Only admins may directly insert; routine assignment uses the SECURITY DEFINER
-- function assign_coach_for_plan(), which bypasses RLS.
CREATE POLICY "Admins can insert assignments"
ON public.coach_assignments
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

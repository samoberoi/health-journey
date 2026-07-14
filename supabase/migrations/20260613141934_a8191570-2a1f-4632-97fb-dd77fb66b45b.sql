ALTER TABLE public.thyrocare_tests ADD COLUMN IF NOT EXISTS coach_assignable boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS thyrocare_tests_coach_assignable_idx ON public.thyrocare_tests(coach_assignable) WHERE coach_assignable;

-- Allow admins to update lab tests (enable/disable, toggle coach_assignable)
DROP POLICY IF EXISTS "Admins manage thyrocare tests" ON public.thyrocare_tests;
CREATE POLICY "Admins manage thyrocare tests"
  ON public.thyrocare_tests
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
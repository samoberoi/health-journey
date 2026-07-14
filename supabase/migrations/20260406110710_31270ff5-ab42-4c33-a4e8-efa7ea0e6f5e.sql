
CREATE POLICY "Coaches can view assigned patient profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'coach') AND
    EXISTS (
      SELECT 1 FROM public.coach_assignments ca
      JOIN public.coaches c ON c.id = ca.coach_id
      WHERE ca.user_id = profiles.user_id
        AND ca.is_active = true
        AND c.user_id = auth.uid()
    )
  );

-- Allow coaches to view assignments where they are the coach
CREATE POLICY "Coaches can view their assignments" ON public.coach_assignments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.id = coach_assignments.coach_id
        AND c.user_id = auth.uid()
    )
  );

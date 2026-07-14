
CREATE POLICY "Coaches can view assigned patient health logs" ON public.health_logs
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'coach') AND
    EXISTS (
      SELECT 1 FROM public.coach_assignments ca
      JOIN public.coaches c ON c.id = ca.coach_id
      WHERE ca.user_id = health_logs.user_id
        AND ca.is_active = true
        AND c.user_id = auth.uid()
    )
  );

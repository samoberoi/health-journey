
CREATE POLICY "Patients manage own results"
  ON public.lab_results FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

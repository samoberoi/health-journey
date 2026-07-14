CREATE POLICY "Coaches can view own profile"
ON public.coaches
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
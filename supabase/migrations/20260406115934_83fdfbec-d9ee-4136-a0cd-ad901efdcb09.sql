
-- Admin RLS: Admin can view ALL profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin RLS: Admin can update ALL profiles
CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin RLS: Admin can view ALL coaches (including inactive)
CREATE POLICY "Admins can view all coaches" ON public.coaches
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin RLS: Admin can update ALL coaches
CREATE POLICY "Admins can update all coaches" ON public.coaches
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin RLS: Admin can insert coaches
CREATE POLICY "Admins can insert coaches" ON public.coaches
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin RLS: Admin can delete coaches
CREATE POLICY "Admins can delete coaches" ON public.coaches
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin RLS: Admin can view ALL subscriptions
CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin RLS: Admin can update subscriptions
CREATE POLICY "Admins can update all subscriptions" ON public.subscriptions
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin RLS: Admin can view ALL coach assignments
CREATE POLICY "Admins can view all assignments" ON public.coach_assignments
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin RLS: Admin can update assignments
CREATE POLICY "Admins can update all assignments" ON public.coach_assignments
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin RLS: Admin can view ALL health logs
CREATE POLICY "Admins can view all health logs" ON public.health_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin RLS: Admin can manage ALL user roles
CREATE POLICY "Admins can insert roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin RLS: Admin can view ALL coach ratings
CREATE POLICY "Admins can view all ratings" ON public.coach_ratings
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

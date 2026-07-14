-- Allow users to delete their own data for account deletion

CREATE POLICY "Users can delete own fasting tracking"
ON public.fasting_tracking FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal photos"
ON public.meal_photos FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own supplement tracking"
ON public.user_supplement_tracking FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own supplement plans"
ON public.user_supplement_plans FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own supplement plan items"
ON public.user_supplement_plan_items FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_supplement_plans p
  WHERE p.id = user_supplement_plan_items.plan_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can delete own protocols"
ON public.user_protocols FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fasting badges"
ON public.user_fasting_badges FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own supplement badges"
ON public.user_supplement_badges FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own diet profile"
ON public.user_diet_profiles FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own coach assignments"
ON public.coach_assignments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own referral codes"
ON public.referral_codes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
ON public.subscriptions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
ON public.profiles FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own roles"
ON public.user_roles FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat messages"
ON public.chat_messages FOR DELETE TO authenticated
USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete own chat conversations"
ON public.chat_conversations FOR DELETE TO authenticated
USING (auth.uid() = patient_id);
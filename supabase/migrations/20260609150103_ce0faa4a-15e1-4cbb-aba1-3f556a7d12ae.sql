
-- 1. COACHES: hide PII from broad authenticated access
DROP POLICY IF EXISTS "Anyone authenticated can view active coaches" ON public.coaches;

CREATE POLICY "Assigned patients can view their coach"
ON public.coaches FOR SELECT
TO authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.coach_assignments ca
    WHERE ca.coach_id = coaches.id
      AND ca.user_id  = auth.uid()
      AND ca.is_active = true
  )
);

CREATE OR REPLACE VIEW public.coaches_public
WITH (security_invoker = false) AS
SELECT id, name, bio, description, specialization, coach_type,
       years_experience, total_consultations, avg_rating, total_ratings,
       avatar_url, languages, qualification, city, is_active
FROM public.coaches
WHERE is_active = true;
GRANT SELECT ON public.coaches_public TO authenticated, anon;

-- 2. COMPLIMENTS: service role inserts only
DROP POLICY IF EXISTS "System can insert compliments" ON public.compliments;
CREATE POLICY "Service role can insert compliments"
ON public.compliments FOR INSERT TO service_role WITH CHECK (true);

-- 3. NOTIFICATIONS: service role inserts only
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT TO service_role WITH CHECK (true);

-- 4. REFERRALS: service role inserts only
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;
CREATE POLICY "Service role can insert referrals"
ON public.referrals FOR INSERT TO service_role WITH CHECK (true);

-- 5. SUBSCRIPTIONS: scope mutate policies to authenticated only
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can update their own subscriptions"
ON public.subscriptions FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own subscriptions"
ON public.subscriptions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 6. THYROCARE_AUTH_CACHE: service role only
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname='public' AND tablename='thyrocare_auth_cache'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.thyrocare_auth_cache', pol.policyname);
  END LOOP;
END$$;
REVOKE ALL ON public.thyrocare_auth_cache FROM authenticated, anon;
GRANT  ALL ON public.thyrocare_auth_cache TO service_role;

-- 7. USER_ROLES: drop user self-delete (admins manage roles)
DROP POLICY IF EXISTS "Users can delete own roles" ON public.user_roles;

-- 8. STORAGE: admin SELECT on coach-documents (meal-photos bucket toggled separately)
DROP POLICY IF EXISTS "Admins can read coach documents" ON storage.objects;
CREATE POLICY "Admins can read coach documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'coach-documents'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- meal-photos storage policies: drop the public SELECT, add owner-scoped SELECT
DROP POLICY IF EXISTS "Anyone can view meal photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own meal photos" ON storage.objects;
CREATE POLICY "Users can view own meal photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'meal-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

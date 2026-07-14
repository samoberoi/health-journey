
-- 1. Add channel_partner role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'channel_partner';

-- 2. Link partners to auth users
ALTER TABLE public.channel_partners
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_channel_partners_user_id ON public.channel_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_partners_phone ON public.channel_partners(contact_phone);

-- 3. Seed Arunendra's phone if empty
UPDATE public.channel_partners
   SET contact_phone = '9999900001'
 WHERE name = 'Arunendra' AND (contact_phone IS NULL OR contact_phone = '');

-- 4. Slots table (backend for group classes + private sessions)
CREATE TABLE IF NOT EXISTS public.channel_partner_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.channel_partners(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.channel_partner_packages(id) ON DELETE SET NULL,
  package_type text NOT NULL CHECK (package_type IN ('group','private')),
  title text,
  scheduled_at timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 60,
  meet_link text,
  capacity integer NOT NULL DEFAULT 10,
  booked_count integer NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cp_slots_partner ON public.channel_partner_slots(partner_id);
CREATE INDEX IF NOT EXISTS idx_cp_slots_package ON public.channel_partner_slots(package_id);
CREATE INDEX IF NOT EXISTS idx_cp_slots_time ON public.channel_partner_slots(scheduled_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_partner_slots TO authenticated;
GRANT ALL ON public.channel_partner_slots TO service_role;

ALTER TABLE public.channel_partner_slots ENABLE ROW LEVEL SECURITY;

-- Signed-in users can see active upcoming slots (for booking)
CREATE POLICY "Anyone signed in can view active slots"
  ON public.channel_partner_slots FOR SELECT TO authenticated
  USING (is_active = true);

-- Partner owner (linked via channel_partners.user_id) can manage own slots
CREATE POLICY "Partner can manage own slots"
  ON public.channel_partner_slots FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.channel_partners cp
            WHERE cp.id = partner_id AND cp.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.channel_partners cp
            WHERE cp.id = partner_id AND cp.user_id = auth.uid())
  );

-- Admins full access
CREATE POLICY "Admins manage all slots"
  ON public.channel_partner_slots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_cp_slots_updated_at BEFORE UPDATE ON public.channel_partner_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. yoga_bookings.slot_id (link a booking to a specific slot when applicable)
ALTER TABLE public.yoga_bookings
  ADD COLUMN IF NOT EXISTS slot_id uuid REFERENCES public.channel_partner_slots(id) ON DELETE SET NULL;

-- Let partners view bookings for their own packages
DROP POLICY IF EXISTS "Partner can view own bookings" ON public.yoga_bookings;
CREATE POLICY "Partner can view own bookings"
  ON public.yoga_bookings FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.channel_partners cp
            WHERE cp.id = partner_id AND cp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Partner can update own bookings" ON public.yoga_bookings;
CREATE POLICY "Partner can update own bookings"
  ON public.yoga_bookings FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.channel_partners cp
            WHERE cp.id = partner_id AND cp.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.channel_partners cp
            WHERE cp.id = partner_id AND cp.user_id = auth.uid())
  );

-- Also let partners read basic profile info of users who booked (name)
DROP POLICY IF EXISTS "Partners can view booked user profiles" ON public.profiles;
CREATE POLICY "Partners can view booked user profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.yoga_bookings yb
      JOIN public.channel_partners cp ON cp.id = yb.partner_id
      WHERE yb.user_id = profiles.user_id AND cp.user_id = auth.uid()
    )
  );

-- 6. Link function (mirrors link_coach_to_user)
CREATE OR REPLACE FUNCTION public.link_partner_to_user(_user_id uuid, _phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _partner_id uuid;
BEGIN
  UPDATE public.channel_partners
     SET user_id = _user_id
   WHERE contact_phone = _phone
     AND (user_id IS NULL OR user_id = _user_id)
     AND is_active = true
  RETURNING id INTO _partner_id;

  IF _partner_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'channel_partner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN _partner_id;
END;
$$;


-- 1. Extend video_metadata with enabled + custom flags
ALTER TABLE public.video_metadata
  ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Allow anon+authenticated to read enabled videos (for public library resolution)
GRANT SELECT ON public.video_metadata TO anon, authenticated;

-- 2. Extend channel_partner_packages with schedule slots (for group classes)
ALTER TABLE public.channel_partner_packages
  ADD COLUMN IF NOT EXISTS schedule_slots jsonb NOT NULL DEFAULT '[]'::jsonb;

GRANT SELECT ON public.channel_partners TO authenticated;
GRANT SELECT ON public.channel_partner_packages TO authenticated;

-- 3. Yoga / channel-partner bookings
CREATE TABLE IF NOT EXISTS public.yoga_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.channel_partners(id) ON DELETE RESTRICT,
  package_id uuid NOT NULL REFERENCES public.channel_partner_packages(id) ON DELETE RESTRICT,
  package_type text NOT NULL,
  price_inr integer NOT NULL,
  selected_slot text,
  preferred_time text,
  preferred_days text[] DEFAULT ARRAY[]::text[],
  notes text,
  status text NOT NULL DEFAULT 'pending_schedule',
  payment_status text NOT NULL DEFAULT 'paid',
  payment_ref text,
  starts_on date,
  expires_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.yoga_bookings TO authenticated;
GRANT ALL ON public.yoga_bookings TO service_role;

ALTER TABLE public.yoga_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own yoga bookings"
  ON public.yoga_bookings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own yoga bookings"
  ON public.yoga_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own yoga bookings"
  ON public.yoga_bookings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_yoga_bookings_updated_at
  BEFORE UPDATE ON public.yoga_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

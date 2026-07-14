
-- Partners table
CREATE TABLE public.channel_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_type TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  bio TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  bbdo_commission_pct NUMERIC(5,2) NOT NULL DEFAULT 20 CHECK (bbdo_commission_pct >= 0 AND bbdo_commission_pct <= 100),
  partner_commission_pct NUMERIC(5,2) NOT NULL DEFAULT 80 CHECK (partner_commission_pct >= 0 AND partner_commission_pct <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_partners TO authenticated;
GRANT ALL ON public.channel_partners TO service_role;

ALTER TABLE public.channel_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view active partners"
  ON public.channel_partners FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage partners"
  ON public.channel_partners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_channel_partners_updated
  BEFORE UPDATE ON public.channel_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Packages table
CREATE TABLE public.channel_partner_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.channel_partners(id) ON DELETE CASCADE,
  package_type TEXT NOT NULL CHECK (package_type IN ('group','private')),
  name TEXT NOT NULL,
  description TEXT,
  price_inr INTEGER NOT NULL CHECK (price_inr >= 0),
  classes_per_month INTEGER CHECK (classes_per_month IS NULL OR classes_per_month >= 0),
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_partner_packages TO authenticated;
GRANT ALL ON public.channel_partner_packages TO service_role;

ALTER TABLE public.channel_partner_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view active packages"
  ON public.channel_partner_packages FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage packages"
  ON public.channel_partner_packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_channel_partner_packages_updated
  BEFORE UPDATE ON public.channel_partner_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_channel_partner_packages_partner ON public.channel_partner_packages(partner_id);
CREATE INDEX idx_channel_partners_type ON public.channel_partners(partner_type);

-- Seed: Arunendra + 2 yoga packages
WITH new_partner AS (
  INSERT INTO public.channel_partners (partner_type, name, bio, bbdo_commission_pct, partner_commission_pct)
  VALUES ('yoga', 'Arunendra', 'Certified yoga instructor leading BBDO group and private sessions.', 20, 80)
  RETURNING id
)
INSERT INTO public.channel_partner_packages (partner_id, package_type, name, description, price_inr, classes_per_month, duration_minutes, sort_order)
SELECT id, 'group',   'Group Yoga Classes',    'Live group yoga sessions guided by Arunendra.', 4000,  8, 60, 1 FROM new_partner
UNION ALL
SELECT id, 'private', 'Private 1-on-1 Yoga',   'Personalised one-on-one yoga sessions with Arunendra.', 12000, 4, 60, 2 FROM new_partner;

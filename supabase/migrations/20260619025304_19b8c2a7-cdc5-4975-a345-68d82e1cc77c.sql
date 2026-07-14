
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  badge TEXT,
  accent TEXT NOT NULL DEFAULT 'basic',
  base_monthly_price NUMERIC NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.packages TO anon, authenticated;
GRANT ALL ON public.packages TO authenticated, service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view packages" ON public.packages FOR SELECT USING (true);
CREATE POLICY "Admins manage packages" ON public.packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.package_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  billing_cycle TEXT NOT NULL,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id, billing_cycle)
);
GRANT SELECT ON public.package_pricing TO anon, authenticated;
GRANT ALL ON public.package_pricing TO authenticated, service_role;
ALTER TABLE public.package_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view package pricing" ON public.package_pricing FOR SELECT USING (true);
CREATE POLICY "Admins manage package pricing" ON public.package_pricing FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_package_pricing_updated_at BEFORE UPDATE ON public.package_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.packages (plan_key, name, tagline, badge, accent, base_monthly_price, features, sort_order) VALUES
('foundation', 'Foundation Care', 'Self-guided start', 'BASIC', 'basic', 499, '["General BBDO 5-Punch tracking","Full Health education video library","Curated Food & lifestyle recommendations","App access & community","Health milestone badges","Email support"]'::jsonb, 1),
('active', 'Active Health Tracker', 'Tracked every week', 'MOST POPULAR', 'popular', 1499, '["Everything in Foundation","Weekly Expert connect & check-ins","Daily Sugar logging (Glucometer / CGM)","Health metric tracking dashboard","In-app chat support","Supplement & booster guidance"]'::jsonb, 2),
('intensive', 'Intensive Reversal Care', 'Maximum support', 'PREMIUM', 'premium', 2999, '["Everything in Active","Personalized BBDO 5-Punch plan","Unlimited Expert consultations","Priority WhatsApp & escalation support","1:1 nutrition & meal planning","Continuous Glucose Monitor support","Quarterly diagnostic review"]'::jsonb, 3);

INSERT INTO public.package_pricing (package_id, billing_cycle, discount_percent)
SELECT id, c.cycle, c.disc FROM public.packages
CROSS JOIN (VALUES ('monthly', 0), ('quarterly', 10), ('half_yearly', 15), ('yearly', 25)) AS c(cycle, disc);

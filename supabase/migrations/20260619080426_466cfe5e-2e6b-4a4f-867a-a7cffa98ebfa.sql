
CREATE TABLE public.commission_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  percent NUMERIC(5,2) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  payout_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (payout_frequency IN ('monthly','quarterly','weekly')),
  payout_day SMALLINT NOT NULL DEFAULT 7 CHECK (payout_day BETWEEN 1 AND 31),
  min_active_patients INTEGER NOT NULL DEFAULT 0,
  min_avg_rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  applies_to TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  rules TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_models TO authenticated;
GRANT ALL ON public.commission_models TO service_role;

ALTER TABLE public.commission_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commission models"
  ON public.commission_models FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can view active commission models"
  ON public.commission_models FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach') AND is_active = true);

CREATE TRIGGER trg_commission_models_updated_at
  BEFORE UPDATE ON public.commission_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS commission_model_id UUID REFERENCES public.commission_models(id) ON DELETE SET NULL;

INSERT INTO public.commission_models (name, description, percent, payout_frequency, payout_day, min_active_patients, min_avg_rating, applies_to, rules, is_default)
VALUES
  ('Standard', 'Entry tier for new coaches in their first 90 days.', 8.00, 'monthly', 7, 0, 0.0, ARRAY['foundation','active'], 'Applied during onboarding period. Auto-upgrades on tenure/rating review.', true),
  ('Growth', 'Mid-tier for active coaches with steady patient load.', 10.00, 'monthly', 7, 15, 4.0, ARRAY['active','intensive'], 'Requires ≥15 active patients and 4.0+ avg rating maintained over last 30 days.', false),
  ('Elite', 'Top tier for high-performing senior coaches.', 12.50, 'monthly', 7, 30, 4.5, ARRAY['active','intensive'], 'Requires ≥30 active patients, 4.5+ avg rating, and 6+ months tenure.', false);

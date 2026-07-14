
CREATE TABLE public.user_plates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Plate',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_carbs_g NUMERIC,
  total_protein_g NUMERIC,
  total_fat_g NUMERIC,
  total_fiber_g NUMERIC,
  total_calories_kcal NUMERIC,
  avg_gi NUMERIC,
  gi_band TEXT,
  sugar_spike_risk TEXT,
  is_todays_meal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plates TO authenticated;
GRANT ALL ON public.user_plates TO service_role;

ALTER TABLE public.user_plates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own plates" ON public.user_plates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_user_plates_updated_at
  BEFORE UPDATE ON public.user_plates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_user_plates_user ON public.user_plates(user_id, created_at DESC);

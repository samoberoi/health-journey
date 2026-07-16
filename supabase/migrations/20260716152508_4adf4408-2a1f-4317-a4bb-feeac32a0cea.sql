
CREATE TABLE public.apple_health_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  steps INTEGER,
  active_calories INTEGER,
  distance_meters INTEGER,
  exercise_minutes INTEGER,
  resting_heart_rate INTEGER,
  hrv_ms INTEGER,
  sleep_hours NUMERIC(4,2),
  weight_kg NUMERIC(6,2),
  weight_at TIMESTAMPTZ,
  glucose_mg_dl INTEGER,
  glucose_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apple_health_snapshots TO authenticated;
GRANT ALL ON public.apple_health_snapshots TO service_role;

ALTER TABLE public.apple_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own health snapshots"
  ON public.apple_health_snapshots
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX apple_health_snapshots_user_date_idx
  ON public.apple_health_snapshots (user_id, date DESC);

CREATE TRIGGER update_apple_health_snapshots_updated_at
  BEFORE UPDATE ON public.apple_health_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.health_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_type TEXT NOT NULL CHECK (log_type IN ('diabetes', 'bp', 'weight')),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  glucose_morning NUMERIC,
  glucose_evening NUMERIC,
  bp_systolic NUMERIC,
  bp_diastolic NUMERIC,
  weight_kg NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own health logs"
  ON public.health_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own health logs"
  ON public.health_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own health logs"
  ON public.health_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own health logs"
  ON public.health_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_health_logs_user_type ON public.health_logs(user_id, log_type, logged_at DESC);

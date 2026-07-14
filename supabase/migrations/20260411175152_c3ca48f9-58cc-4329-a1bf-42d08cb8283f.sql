
-- Add initial score tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS initial_health_score numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS initial_assessment_date timestamp with time zone DEFAULT NULL;

-- Create health score alerts table for coaches
CREATE TABLE public.health_score_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  coach_id uuid REFERENCES public.coaches(id) ON DELETE CASCADE,
  previous_score numeric NOT NULL,
  new_score numeric NOT NULL,
  score_delta numeric NOT NULL,
  alert_type text NOT NULL DEFAULT 'decline',
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.health_score_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own score alerts"
ON public.health_score_alerts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Coaches can view patient score alerts"
ON public.health_score_alerts FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coach'::app_role) AND
  EXISTS (
    SELECT 1 FROM coach_assignments ca
    JOIN coaches c ON c.id = ca.coach_id
    WHERE ca.user_id = health_score_alerts.user_id
    AND ca.is_active = true
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Coaches can update own alerts"
ON public.health_score_alerts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM coaches c
    WHERE c.id = health_score_alerts.coach_id
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all score alerts"
ON public.health_score_alerts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert score alerts"
ON public.health_score_alerts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own score alerts"
ON public.health_score_alerts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_health_score_alerts_coach ON public.health_score_alerts(coach_id, acknowledged);
CREATE INDEX idx_health_score_alerts_user ON public.health_score_alerts(user_id);

-- food_condition_rules
CREATE TABLE IF NOT EXISTS public.food_condition_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condition_key TEXT NOT NULL,
  action TEXT NOT NULL,
  name_pattern TEXT NOT NULL,
  filter_id UUID NULL,
  reason TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.food_condition_rules TO anon, authenticated;
GRANT ALL ON public.food_condition_rules TO service_role;
ALTER TABLE public.food_condition_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read food condition rules" ON public.food_condition_rules FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage food condition rules" ON public.food_condition_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- fasting_badges extra columns
ALTER TABLE public.fasting_badges
  ADD COLUMN IF NOT EXISTS protocol_id uuid,
  ADD COLUMN IF NOT EXISTS parent_badge_id uuid,
  ADD COLUMN IF NOT EXISTS badge_type text NOT NULL DEFAULT 'stage',
  ADD COLUMN IF NOT EXISTS pattern text,
  ADD COLUMN IF NOT EXISTS milestones_required int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stage_order int NOT NULL DEFAULT 1;

-- user_fasting_milestones
CREATE TABLE IF NOT EXISTS public.user_fasting_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.fasting_badges(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id, week_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_fasting_milestones TO authenticated;
GRANT ALL ON public.user_fasting_milestones TO service_role;
ALTER TABLE public.user_fasting_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own milestones" ON public.user_fasting_milestones
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- fasting_stage_milestones
CREATE TABLE IF NOT EXISTS public.fasting_stage_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id uuid NOT NULL REFERENCES public.fasting_badges(id) ON DELETE CASCADE,
  milestone_order int NOT NULL,
  compliant_days_required int NOT NULL DEFAULT 7,
  milestone_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fasting_stage_milestones TO anon, authenticated;
GRANT ALL ON public.fasting_stage_milestones TO service_role;
ALTER TABLE public.fasting_stage_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view stage milestones" ON public.fasting_stage_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage stage milestones" ON public.fasting_stage_milestones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Supplement badge definitions
CREATE TABLE public.supplement_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  badge_key TEXT NOT NULL UNIQUE,
  badge_name TEXT NOT NULL,
  badge_emoji TEXT NOT NULL DEFAULT '💊',
  description TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  required_streak_days INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.supplement_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view supplement badges"
  ON public.supplement_badges FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage supplement badges"
  ON public.supplement_badges FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert supplement badges"
  ON public.supplement_badges FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- User earned supplement badges
CREATE TABLE public.user_supplement_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.supplement_badges(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_supplement_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own supplement badges"
  ON public.user_supplement_badges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own supplement badges"
  ON public.user_supplement_badges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own supplement badges"
  ON public.user_supplement_badges FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all supplement badges"
  ON public.user_supplement_badges FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coaches can view patient supplement badges"
  ON public.user_supplement_badges FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'coach'::app_role) AND EXISTS (
      SELECT 1 FROM coach_assignments ca
      JOIN coaches c ON c.id = ca.coach_id
      WHERE ca.user_id = user_supplement_badges.user_id
        AND ca.is_active = true AND c.user_id = auth.uid()
    )
  );

-- Seed default supplement badges
INSERT INTO public.supplement_badges (badge_key, badge_name, badge_emoji, description, level, required_streak_days) VALUES
  ('supp_starter', 'Pill Starter', '💊', 'Took all supplements for 3 consecutive days', 1, 3),
  ('supp_consistent', 'Consistent Taker', '🎯', 'Perfect supplement adherence for 7 days', 2, 7),
  ('supp_dedicated', 'Dedicated Health Warrior', '🛡️', '14-day supplement streak', 3, 14),
  ('supp_committed', 'Committed to Wellness', '💪', '21-day supplement streak', 4, 21),
  ('supp_master', 'Supplement Master', '🏆', '30-day perfect supplement adherence', 5, 30),
  ('supp_legend', 'Health Legend', '👑', '60-day supplement streak — unstoppable!', 6, 60);

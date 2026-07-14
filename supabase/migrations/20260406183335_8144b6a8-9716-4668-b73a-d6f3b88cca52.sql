
-- Fasting badge definitions
CREATE TABLE public.fasting_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_key text NOT NULL UNIQUE,
  badge_name text NOT NULL,
  badge_emoji text NOT NULL DEFAULT '🔥',
  description text,
  level integer NOT NULL DEFAULT 1,
  required_streak_days integer NOT NULL DEFAULT 7,
  week_range_start integer,
  week_range_end integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fasting_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view badges" ON public.fasting_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage badges" ON public.fasting_badges FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert badges" ON public.fasting_badges FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- User earned badges
CREATE TABLE public.user_fasting_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.fasting_badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_fasting_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own badges" ON public.user_fasting_badges FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own badges" ON public.user_fasting_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own badges" ON public.user_fasting_badges FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Coaches can view patient badges" ON public.user_fasting_badges FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) AND EXISTS (
    SELECT 1 FROM coach_assignments ca JOIN coaches c ON c.id = ca.coach_id
    WHERE ca.user_id = user_fasting_badges.user_id AND ca.is_active = true AND c.user_id = auth.uid()
  ));
CREATE POLICY "Admins can view all badges" ON public.user_fasting_badges FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed badge definitions
INSERT INTO public.fasting_badges (badge_key, badge_name, badge_emoji, description, level, required_streak_days, week_range_start, week_range_end) VALUES
  ('fasting_initiate', 'Fasting Initiate', '🌱', 'Complete your first 7-day fasting streak', 1, 7, 1, 4),
  ('metabolic_warrior', 'Metabolic Warrior', '⚔️', 'Sustain 14 consecutive days of fasting', 2, 14, 5, 8),
  ('fat_burner', 'Fat Burner', '🔥', 'Achieve a 21-day fasting streak', 3, 21, 9, 12),
  ('ketone_master', 'Ketone Master', '⚡', 'Maintain 28 consecutive fasting days', 4, 28, 13, 16),
  ('autophagy_elite', 'Autophagy Elite', '🧬', 'Hit a 42-day fasting streak', 5, 42, 17, 20),
  ('metabolic_champion', 'Metabolic Champion', '👑', 'Complete 24 weeks — ultimate metabolic mastery', 6, 56, 21, 24);

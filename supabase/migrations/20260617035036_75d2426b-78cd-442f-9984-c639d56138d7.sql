
-- =========================================================
-- MOVEMENT MODULE
-- =========================================================

-- 1. Configuration (singleton row)
CREATE TABLE public.movement_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  base_daily_steps INTEGER NOT NULL DEFAULT 5000,
  increment_per_level INTEGER NOT NULL DEFAULT 1000,
  weeks_per_level INTEGER NOT NULL DEFAULT 1,
  min_days_per_week INTEGER NOT NULL DEFAULT 5,   -- days/week user must hit target
  miss_policy TEXT NOT NULL DEFAULT 'hold',        -- 'hold' | 'reset' | 'demote'
  -- modifiers (multipliers applied to base on assignment)
  bmi_modifiers JSONB NOT NULL DEFAULT '{"underweight":1.0,"normal":1.0,"overweight":0.85,"obese":0.7}'::jsonb,
  activity_modifiers JSONB NOT NULL DEFAULT '{"sedentary":0.7,"light":0.85,"moderate":1.0,"active":1.15,"very_active":1.3}'::jsonb,
  age_modifiers JSONB NOT NULL DEFAULT '{"under_30":1.0,"30_45":0.95,"45_60":0.85,"over_60":0.7}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.movement_config TO authenticated;
GRANT ALL ON public.movement_config TO service_role;
ALTER TABLE public.movement_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read movement config"
  ON public.movement_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage movement config"
  ON public.movement_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2. Levels
CREATE TABLE public.movement_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_number INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  target_daily_steps INTEGER NOT NULL,
  badge_icon TEXT NOT NULL DEFAULT '🏃',
  badge_color TEXT NOT NULL DEFAULT '#1E3A8A',
  accent_color TEXT NOT NULL DEFAULT '#1E3A8A',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.movement_levels TO authenticated;
GRANT ALL ON public.movement_levels TO service_role;
ALTER TABLE public.movement_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read movement levels"
  ON public.movement_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage movement levels"
  ON public.movement_levels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3. Badges
CREATE TABLE public.movement_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT '🏅',
  color TEXT NOT NULL DEFAULT '#F59E0B',
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {type:'level_complete', level:3} or {type:'streak', weeks:4}
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.movement_badges TO authenticated;
GRANT ALL ON public.movement_badges TO service_role;
ALTER TABLE public.movement_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read movement badges"
  ON public.movement_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage movement badges"
  ON public.movement_badges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. User progress
CREATE TABLE public.user_movement_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  current_level INTEGER NOT NULL DEFAULT 1,
  weeks_at_current_level INTEGER NOT NULL DEFAULT 0,
  current_streak_weeks INTEGER NOT NULL DEFAULT 0,
  longest_streak_weeks INTEGER NOT NULL DEFAULT 0,
  total_weeks_completed INTEGER NOT NULL DEFAULT 0,
  total_weeks_missed INTEGER NOT NULL DEFAULT 0,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_movement_progress TO authenticated;
GRANT ALL ON public.user_movement_progress TO service_role;
ALTER TABLE public.user_movement_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own progress"
  ON public.user_movement_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.coach_owns_patient(user_id));
CREATE POLICY "Users insert own progress"
  ON public.user_movement_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users update own progress"
  ON public.user_movement_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete progress"
  ON public.user_movement_progress FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 5. Weekly tracking
CREATE TABLE public.user_movement_weekly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  level_at_week INTEGER NOT NULL,
  target_daily_steps INTEGER NOT NULL,
  days_hit_target INTEGER NOT NULL DEFAULT 0,
  avg_daily_steps INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',  -- in_progress | completed | missed
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_movement_weekly TO authenticated;
GRANT ALL ON public.user_movement_weekly TO service_role;
ALTER TABLE public.user_movement_weekly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own weekly"
  ON public.user_movement_weekly FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.coach_owns_patient(user_id));
CREATE POLICY "Users insert own weekly"
  ON public.user_movement_weekly FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users update own weekly"
  ON public.user_movement_weekly FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete weekly"
  ON public.user_movement_weekly FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 6. Earned badges
CREATE TABLE public.user_movement_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_code TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_code)
);
GRANT SELECT, INSERT, DELETE ON public.user_movement_badges TO authenticated;
GRANT ALL ON public.user_movement_badges TO service_role;
ALTER TABLE public.user_movement_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own movement badges"
  ON public.user_movement_badges FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.coach_owns_patient(user_id));
CREATE POLICY "Users insert own movement badges"
  ON public.user_movement_badges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete movement badges"
  ON public.user_movement_badges FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- updated_at triggers
CREATE TRIGGER trg_movement_config_updated BEFORE UPDATE ON public.movement_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_movement_levels_updated BEFORE UPDATE ON public.movement_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_movement_badges_updated BEFORE UPDATE ON public.movement_badges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_user_movement_progress_updated BEFORE UPDATE ON public.user_movement_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_user_movement_weekly_updated BEFORE UPDATE ON public.user_movement_weekly
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =========================================================
-- SEED DATA
-- =========================================================
INSERT INTO public.movement_config (is_active) VALUES (true);

INSERT INTO public.movement_levels (level_number, name, description, target_daily_steps, badge_icon, badge_color, accent_color) VALUES
  (1, 'First Steps', 'Where every journey begins. Build the daily habit.', 5000, '🐣', '#10B981', '#10B981'),
  (2, 'Pathfinder', 'Finding your rhythm — one block at a time.', 6000, '🧭', '#10B981', '#10B981'),
  (3, 'Trailblazer', 'Carving your own path. Consistency unlocked.', 7000, '🌿', '#1E3A8A', '#1E3A8A'),
  (4, 'Pacesetter', 'You set the tempo now.', 8000, '⚡', '#1E3A8A', '#1E3A8A'),
  (5, 'Stride Master', 'Steady. Strong. Unmistakable.', 9000, '🏃', '#1E3A8A', '#1E3A8A'),
  (6, 'Momentum', 'The body in motion stays in motion.', 10000, '🔥', '#F59E0B', '#F59E0B'),
  (7, 'Velocity', 'You move with purpose now.', 11000, '🚀', '#F59E0B', '#F59E0B'),
  (8, 'Summit', 'Climbing toward your peak self.', 12000, '⛰️', '#E63946', '#E63946'),
  (9, 'Apex', 'Top of the mountain. Elite zone.', 13000, '🦅', '#E63946', '#E63946'),
  (10, 'Legend', 'Walking myth. The bar everyone aims for.', 15000, '👑', '#E63946', '#E63946');

INSERT INTO public.movement_badges (code, name, description, icon, color, criteria) VALUES
  ('week_one',     'Week One',       'Completed your first full week.',           '🌱', '#10B981', '{"type":"weeks_completed","count":1}'),
  ('steady_stride','Steady Stride',  'Four-week streak — habit formed.',          '🔁', '#1E3A8A', '{"type":"streak","weeks":4}'),
  ('level_up',     'Level Up',       'Earned your first level promotion.',        '⬆️', '#1E3A8A', '{"type":"level_reached","level":2}'),
  ('iron_streak',  'Iron Streak',    'Twelve weeks unbroken. Iron will.',         '🛡️', '#F59E0B', '{"type":"streak","weeks":12}'),
  ('apex_mover',   'Apex Mover',     'Reached the Apex level. Rarefied air.',     '🦅', '#E63946', '{"type":"level_reached","level":9}');

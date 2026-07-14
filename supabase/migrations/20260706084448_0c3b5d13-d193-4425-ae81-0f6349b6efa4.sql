
-- ============ exercise_categories ============
CREATE TABLE public.exercise_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '💪',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exercise_categories TO authenticated;
GRANT ALL ON public.exercise_categories TO service_role;
ALTER TABLE public.exercise_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view exercise categories"
  ON public.exercise_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage exercise categories"
  ON public.exercise_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_exercise_categories_updated_at
  BEFORE UPDATE ON public.exercise_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ exercises ============
CREATE TABLE public.exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.exercise_categories(id) ON DELETE RESTRICT,
  tier INTEGER NOT NULL CHECK (tier IN (1,2,3)),
  plan_key TEXT NOT NULL CHECK (plan_key IN ('foundation','active','intensive')),
  reps_duration TEXT NOT NULL DEFAULT '',
  sets TEXT NOT NULL DEFAULT '',
  youtube_url TEXT NOT NULL DEFAULT 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  image_url TEXT,
  icon TEXT DEFAULT '🏋️',
  instructions TEXT DEFAULT '',
  benefits TEXT DEFAULT '',
  cautions TEXT DEFAULT '',
  knee_pain_substitute TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view exercises"
  ON public.exercises FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage exercises"
  ON public.exercises FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_exercises_tier ON public.exercises(tier);
CREATE INDEX idx_exercises_plan_key ON public.exercises(plan_key);
CREATE INDEX idx_exercises_category ON public.exercises(category_id);

CREATE TRIGGER update_exercises_updated_at
  BEFORE UPDATE ON public.exercises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ exercise_badges ============
CREATE TABLE public.exercise_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '🏅',
  color TEXT NOT NULL DEFAULT '#1E3A8A',
  tier_required INTEGER NOT NULL DEFAULT 1 CHECK (tier_required IN (1,2,3)),
  criteria_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exercise_badges TO authenticated;
GRANT ALL ON public.exercise_badges TO service_role;
ALTER TABLE public.exercise_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view exercise badges"
  ON public.exercise_badges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage exercise badges"
  ON public.exercise_badges FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_exercise_badges_updated_at
  BEFORE UPDATE ON public.exercise_badges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ user_exercise_logs ============
CREATE TABLE public.user_exercise_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sets_done INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_exercise_logs TO authenticated;
GRANT ALL ON public.user_exercise_logs TO service_role;
ALTER TABLE public.user_exercise_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own exercise logs"
  ON public.user_exercise_logs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_user_exercise_logs_user ON public.user_exercise_logs(user_id);
CREATE INDEX idx_user_exercise_logs_exercise ON public.user_exercise_logs(exercise_id);

-- ============ user_exercise_badges ============
CREATE TABLE public.user_exercise_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_key TEXT NOT NULL REFERENCES public.exercise_badges(key) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_key)
);
GRANT SELECT, INSERT, DELETE ON public.user_exercise_badges TO authenticated;
GRANT ALL ON public.user_exercise_badges TO service_role;
ALTER TABLE public.user_exercise_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own badges, admins view all"
  ON public.user_exercise_badges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own badges"
  ON public.user_exercise_badges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete badges"
  ON public.user_exercise_badges FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_user_exercise_badges_user ON public.user_exercise_badges(user_id);

-- ============ SEED categories ============
INSERT INTO public.exercise_categories (slug, name, icon, sort_order) VALUES
  ('strength', 'Strength (ST)', '🏋️', 1),
  ('resistance_training', 'Resistance Training (RT)', '🎯', 2);

-- ============ SEED badges ============
INSERT INTO public.exercise_badges (key, name, description, icon, color, tier_required, criteria_json, sort_order) VALUES
  ('mobility',   'Mobility',   'Move with control. Complete 3 Foundation exercises.', '🧘', '#10B981', 1, '{"required_completions":3,"plan_key":"foundation"}'::jsonb, 1),
  ('stability',  'Stability',  'Build your base. Complete 5 Foundation exercises.',  '🪨', '#0EA5E9', 1, '{"required_completions":5,"plan_key":"foundation"}'::jsonb, 2),
  ('strength',   'Strength',   'Get stronger. Complete 5 Active Strength exercises.', '💪', '#1E3A8A', 2, '{"required_completions":5,"plan_key":"active","category_slug":"strength"}'::jsonb, 3),
  ('resistance', 'Resistance', 'Push harder. Complete 5 Active Resistance exercises.', '🎯', '#F59E0B', 2, '{"required_completions":5,"plan_key":"active","category_slug":"resistance_training"}'::jsonb, 4),
  ('power',      'Power',      'Peak performance. Complete 5 Intensive exercises.',  '⚡', '#E63946', 3, '{"required_completions":5,"plan_key":"intensive"}'::jsonb, 5);

-- ============ SEED exercises ============
DO $$
DECLARE
  _st UUID; _rt UUID;
BEGIN
  SELECT id INTO _st FROM public.exercise_categories WHERE slug = 'strength';
  SELECT id INTO _rt FROM public.exercise_categories WHERE slug = 'resistance_training';

  -- FOUNDATION (tier 1) — Strength
  INSERT INTO public.exercises (name, category_id, tier, plan_key, reps_duration, sets, icon, knee_pain_substitute, sort_order) VALUES
    ('Isometric Wall Sit', _st, 1, 'foundation', '20–30 sec hold', '2–3', '🧱', 'Seated Isometric Quad Holds or Glute Bridges', 1),
    ('Chair Sit-to-Stand', _st, 1, 'foundation', '10–15 reps', '2–3', '🪑', '', 2),
    ('Wall Push-ups', _st, 1, 'foundation', '10–15 reps', '2–3', '🙌', '', 3),
    ('Glute Bridge', _st, 1, 'foundation', '12–15 reps', '2–3', '🌉', '', 4),
    ('Standing Calf Raises', _st, 1, 'foundation', '15–20 reps', '2–3', '🦵', '', 5),
    ('Bird Dog', _st, 1, 'foundation', '10–12 reps / side', '2–3', '🐦', '', 6),
    ('Side Leg Raises', _st, 1, 'foundation', '12–15 reps / side', '2–3', '↔️', '', 7),
    ('Forearm Plank', _st, 1, 'foundation', '20–30 sec hold', '2–3', '📏', '', 8),
    ('Dead Bug', _st, 1, 'foundation', '10–12 reps / side', '2–3', '🪲', '', 9),
    ('Farmer''s Carry (Water Bottles)', _st, 1, 'foundation', '30–45 sec', '2–3', '💧', '', 10);

  -- FOUNDATION (tier 1) — Resistance
  INSERT INTO public.exercises (name, category_id, tier, plan_key, reps_duration, sets, icon, knee_pain_substitute, sort_order) VALUES
    ('Resistance Band Row', _rt, 1, 'foundation', '12–15 reps', '2–3', '🪢', '', 1),
    ('Resistance Band Chest Press', _rt, 1, 'foundation', '12–15 reps', '2–3', '🎽', '', 2),
    ('Resistance Band Bicep Curl', _rt, 1, 'foundation', '12–15 reps', '2–3', '💪', '', 3),
    ('Resistance Band Shoulder Press', _rt, 1, 'foundation', '12–15 reps', '2–3', '🏋️', '', 4),
    ('Resistance Band Lateral Walk', _rt, 1, 'foundation', '10–15 steps / side', '2–3', '🚶', '', 5),
    ('Standing Band Pull Apart', _rt, 1, 'foundation', '12–15 reps', '2–3', '🎗️', '', 6),
    ('Mini Squats', _rt, 1, 'foundation', '10–15 reps', '2–3', '🦵', 'Seated Isometric Quad Holds or Glute Bridges', 7),
    ('Seated Knee Extension w/ Band', _rt, 1, 'foundation', '12–15 reps', '2–3', '🦿', '', 8),
    ('Band Hip Abduction', _rt, 1, 'foundation', '12–15 reps / side', '2–3', '🩱', '', 9),
    ('Standing Heel Raises w/ Load', _rt, 1, 'foundation', '15–20 reps', '2–3', '👟', '', 10);

  -- ACTIVE (tier 2) — Strength
  INSERT INTO public.exercises (name, category_id, tier, plan_key, reps_duration, sets, icon, knee_pain_substitute, sort_order) VALUES
    ('Chair Squats', _st, 2, 'active', '12–15 reps', '2–3', '🪑', '', 1),
    ('Incline Push-ups', _st, 2, 'active', '10–15 reps', '2–3', '📐', '', 2),
    ('Walking Lunges', _st, 2, 'active', '10–12 reps / leg', '2–3', '🚶', 'Reverse Step-back Lunges', 3),
    ('Step-ups', _st, 2, 'active', '10–12 reps / leg', '2–3', '🪜', 'Low Step Taps', 4),
    ('Side Plank', _st, 2, 'active', '20–30 sec / side', '2–3', '📏', '', 5),
    ('Single-leg Balance', _st, 2, 'active', '30–45 sec / leg', '2–3', '🦩', '', 6),
    ('Bear Crawl Hold', _st, 2, 'active', '20–30 sec', '2–3', '🐻', '', 7),
    ('Plank Shoulder Taps', _st, 2, 'active', '12–16 taps', '2–3', '👋', '', 8),
    ('Superman Hold', _st, 2, 'active', '20–30 sec', '2–3', '🦸', '', 9),
    ('Stair Climbing', _st, 2, 'active', '2–5 min', '2–3', '🪜', '', 10);

  -- ACTIVE (tier 2) — Resistance
  INSERT INTO public.exercises (name, category_id, tier, plan_key, reps_duration, sets, icon, knee_pain_substitute, sort_order) VALUES
    ('Goblet Squat', _rt, 2, 'active', '12–15 reps', '2–3', '🏺', 'Box Squats or Partial Squats', 1),
    ('Resistance Band Deadlift', _rt, 2, 'active', '12–15 reps', '2–3', '🪢', '', 2),
    ('Dumbbell Romanian Deadlift', _rt, 2, 'active', '10–15 reps', '2–3', '🏋️', '', 3),
    ('Dumbbell Shoulder Press', _rt, 2, 'active', '10–15 reps', '2–3', '🏋️', '', 4),
    ('Bent-over Row', _rt, 2, 'active', '12–15 reps', '2–3', '🚣', '', 5),
    ('Resistance Band Pallof Press', _rt, 2, 'active', '12–15 reps / side', '2–3', '🎯', '', 6),
    ('Band Face Pull', _rt, 2, 'active', '12–15 reps', '2–3', '🎗️', '', 7),
    ('Dumbbell Chest Press', _rt, 2, 'active', '10–15 reps', '2–3', '🎽', '', 8),
    ('Standing Wood Chop', _rt, 2, 'active', '12–15 reps / side', '2–3', '🪓', '', 9),
    ('Loaded Farmer''s Walk', _rt, 2, 'active', '30–60 sec', '2–3', '💼', '', 10);

  -- INTENSIVE (tier 3) — Strength
  INSERT INTO public.exercises (name, category_id, tier, plan_key, reps_duration, sets, icon, knee_pain_substitute, sort_order) VALUES
    ('Full Push-ups', _st, 3, 'intensive', '10–20 reps', '3–4', '💪', '', 1),
    ('Bulgarian Split Squat', _st, 3, 'intensive', '8–12 reps / leg', '3–4', '🦵', 'Static Split Squat', 2),
    ('Burpees', _st, 3, 'intensive', '8–15 reps', '3–4', '🔥', 'Squat Thrust', 3),
    ('Mountain Climbers', _st, 3, 'intensive', '30–60 sec', '3–4', '⛰️', 'Standing Climbers', 4),
    ('Jump Squats', _st, 3, 'intensive', '10–15 reps', '3–4', '🦘', 'Speed Squats', 5),
    ('Plank (3 minutes)', _st, 3, 'intensive', 'Hold 3:00 min', '2–3', '📏', '', 6),
    ('Side Plank with Hip Lift', _st, 3, 'intensive', '10–15 reps / side', '3–4', '📐', '', 7),
    ('Bear Crawl', _st, 3, 'intensive', '20–30 sec', '3–4', '🐻', '', 8),
    ('Single-leg Romanian Deadlift', _st, 3, 'intensive', '8–12 reps / leg', '3–4', '🦩', '', 9),
    ('Turkish Get-up', _st, 3, 'intensive', '6–10 reps / side', '2–3', '🌀', '', 10);

  -- INTENSIVE (tier 3) — Resistance
  INSERT INTO public.exercises (name, category_id, tier, plan_key, reps_duration, sets, icon, knee_pain_substitute, sort_order) VALUES
    ('Dumbbell Thrusters', _rt, 3, 'intensive', '10–15 reps', '3–4', '🏋️', 'Shoulder Press + Squat separately', 1),
    ('Kettlebell Swing', _rt, 3, 'intensive', '15–20 reps', '3–4', '🔔', '', 2),
    ('Renegade Row', _rt, 3, 'intensive', '8–12 reps / side', '3–4', '🚣', '', 3),
    ('Resistance Band Sprint Drill', _rt, 3, 'intensive', '20–30 sec', '3–4', '🏃', '', 4),
    ('Heavy Farmer''s Carry', _rt, 3, 'intensive', '40–60 sec', '3–4', '💼', '', 5),
    ('Dumbbell Clean & Press', _rt, 3, 'intensive', '8–12 reps', '3–4', '🏋️', '', 6),
    ('Sumo Deadlift', _rt, 3, 'intensive', '8–12 reps', '3–4', '🏋️', '', 7),
    ('Resistance Band Squat to Press', _rt, 3, 'intensive', '10–15 reps', '3–4', '🎯', 'Hip Hinge to Press', 8),
    ('Walking Farmer''s Carry', _rt, 3, 'intensive', '30–60 sec', '3–4', '💼', '', 9),
    ('Battle Rope (if available)', _rt, 3, 'intensive', '30–45 sec', '3–4', '🪢', '', 10);
END $$;

-- ============ RBAC seed permissions ============
-- Admin already has full via has_role. Grant view to all three user packages by default.
INSERT INTO public.rbac_permissions (role, package_key, module, sub_module, can_view, can_edit, can_delete)
VALUES
  ('user', 'foundation', 'exercise', 'catalog', true, false, false),
  ('user', 'foundation', 'exercise', 'badges',  true, false, false),
  ('user', 'active',     'exercise', 'catalog', true, false, false),
  ('user', 'active',     'exercise', 'badges',  true, false, false),
  ('user', 'intensive',  'exercise', 'catalog', true, false, false),
  ('user', 'intensive',  'exercise', 'badges',  true, false, false),
  ('coach', NULL, 'exercise', 'catalog', true, false, false),
  ('coach', NULL, 'exercise', 'badges',  true, false, false),
  ('coach', NULL, 'exercise', 'logs',    true, false, false)
ON CONFLICT DO NOTHING;

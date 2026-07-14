
-- 1. Recipes table
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  source TEXT NOT NULL DEFAULT 'custom',
  diet_type TEXT NOT NULL DEFAULT 'veg',
  cuisine_type TEXT NOT NULL DEFAULT 'indian',
  meal_type TEXT NOT NULL DEFAULT 'lunch',
  calories NUMERIC,
  carbs NUMERIC,
  protein NUMERIC,
  fat NUMERIC,
  fiber NUMERIC,
  carb_level TEXT GENERATED ALWAYS AS (
    CASE
      WHEN carbs IS NULL THEN NULL
      WHEN carbs < 15 THEN 'LOW'
      WHEN carbs <= 30 THEN 'MEDIUM'
      ELSE 'HIGH'
    END
  ) STORED,
  glycemic_impact TEXT GENERATED ALWAYS AS (
    CASE
      WHEN carbs IS NULL OR fiber IS NULL OR protein IS NULL OR protein = 0 THEN NULL
      WHEN (carbs - fiber + (carbs / protein)) < 10 THEN 'LOW'
      WHEN (carbs - fiber + (carbs / protein)) <= 25 THEN 'MEDIUM'
      ELSE 'HIGH'
    END
  ) STORED,
  protein_density TEXT GENERATED ALWAYS AS (
    CASE
      WHEN protein IS NULL OR calories IS NULL OR calories = 0 THEN NULL
      WHEN (protein * 4 / calories) > 0.3 THEN 'HIGH'
      WHEN (protein * 4 / calories) > 0.15 THEN 'MEDIUM'
      ELSE 'LOW'
    END
  ) STORED,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage recipes" ON public.recipes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Coaches can view active recipes" ON public.recipes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) AND is_active = true);
CREATE POLICY "Users can view active recipes" ON public.recipes FOR SELECT TO authenticated
  USING (is_active = true);

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Medical conditions catalog
CREATE TABLE public.medical_conditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'medical',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage conditions" ON public.medical_conditions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view active conditions" ON public.medical_conditions FOR SELECT TO authenticated
  USING (is_active = true);

-- 3. Recipe-condition mapping
CREATE TABLE public.recipe_conditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  condition_id UUID NOT NULL REFERENCES public.medical_conditions(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'safe',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(recipe_id, condition_id)
);

ALTER TABLE public.recipe_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage recipe conditions" ON public.recipe_conditions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view recipe conditions" ON public.recipe_conditions FOR SELECT TO authenticated
  USING (true);

-- 4. User recipe assignments (coach overrides)
CREATE TABLE public.user_recipe_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  assigned_by UUID,
  is_allowed BOOLEAN NOT NULL DEFAULT true,
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, recipe_id)
);

ALTER TABLE public.user_recipe_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage assignments" ON public.user_recipe_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Coaches can manage patient assignments" ON public.user_recipe_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) AND EXISTS (
    SELECT 1 FROM coach_assignments ca JOIN coaches c ON c.id = ca.coach_id
    WHERE ca.user_id = user_recipe_assignments.user_id AND ca.is_active = true AND c.user_id = auth.uid()
  ));
CREATE POLICY "Users can view own assignments" ON public.user_recipe_assignments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_recipe_assignments_updated_at BEFORE UPDATE ON public.user_recipe_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. User diet profiles
CREATE TABLE public.user_diet_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  diet_preference TEXT NOT NULL DEFAULT 'veg',
  allergies TEXT[] DEFAULT '{}',
  condition_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_diet_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage diet profiles" ON public.user_diet_profiles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Coaches can view patient diet profiles" ON public.user_diet_profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) AND EXISTS (
    SELECT 1 FROM coach_assignments ca JOIN coaches c ON c.id = ca.coach_id
    WHERE ca.user_id = user_diet_profiles.user_id AND ca.is_active = true AND c.user_id = auth.uid()
  ));
CREATE POLICY "Users can view own diet profile" ON public.user_diet_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own diet profile" ON public.user_diet_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own diet profile" ON public.user_diet_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_diet_profiles_updated_at BEFORE UPDATE ON public.user_diet_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. Seed common medical conditions
INSERT INTO public.medical_conditions (name, type, description) VALUES
  ('diabetes', 'medical', 'Type 2 Diabetes Mellitus'),
  ('thyroid', 'medical', 'Hypothyroidism / Hyperthyroidism'),
  ('pcos', 'medical', 'Polycystic Ovary Syndrome'),
  ('hypertension', 'medical', 'High Blood Pressure'),
  ('cholesterol', 'medical', 'High Cholesterol / Dyslipidemia'),
  ('kidney_disease', 'medical', 'Chronic Kidney Disease'),
  ('celiac', 'medical', 'Celiac Disease / Gluten Intolerance'),
  ('lactose_intolerance', 'medical', 'Lactose Intolerance'),
  ('ibs', 'medical', 'Irritable Bowel Syndrome'),
  ('gout', 'medical', 'Gout / Hyperuricemia'),
  ('fatty_liver', 'medical', 'Non-Alcoholic Fatty Liver Disease'),
  ('obesity', 'lifestyle', 'Obesity / Weight Management'),
  ('jain', 'religious', 'Jain dietary restrictions (no root vegetables)'),
  ('halal', 'religious', 'Halal dietary requirements'),
  ('fasting', 'religious', 'Religious fasting considerations');

-- 7. Personalized recipe filtering function
CREATE OR REPLACE FUNCTION public.get_personalized_recipes(_user_id UUID, _meal_type TEXT DEFAULT NULL, _limit INT DEFAULT 10)
RETURNS SETOF public.recipes
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _diet TEXT;
  _conditions UUID[];
BEGIN
  -- Get user diet profile
  SELECT diet_preference, condition_ids INTO _diet, _conditions
  FROM public.user_diet_profiles WHERE user_id = _user_id;

  IF _diet IS NULL THEN _diet := 'veg'; END IF;
  IF _conditions IS NULL THEN _conditions := '{}'; END IF;

  RETURN QUERY
  SELECT r.*
  FROM public.recipes r
  WHERE r.is_active = true
    -- Diet filter
    AND (
      CASE _diet
        WHEN 'veg' THEN r.diet_type IN ('veg', 'vegan')
        WHEN 'vegan' THEN r.diet_type = 'vegan'
        WHEN 'jain' THEN r.diet_type IN ('veg', 'vegan', 'jain')
        ELSE true
      END
    )
    -- Meal type filter
    AND (_meal_type IS NULL OR r.meal_type = _meal_type)
    -- Exclude "avoid" conditions
    AND NOT EXISTS (
      SELECT 1 FROM public.recipe_conditions rc
      WHERE rc.recipe_id = r.id
        AND rc.condition_id = ANY(_conditions)
        AND rc.severity = 'avoid'
    )
    -- Exclude coach-blocked recipes
    AND NOT EXISTS (
      SELECT 1 FROM public.user_recipe_assignments ura
      WHERE ura.user_id = _user_id AND ura.recipe_id = r.id AND ura.is_allowed = false
    )
  ORDER BY
    -- Prioritize coach-assigned recipes
    (EXISTS (SELECT 1 FROM public.user_recipe_assignments ura WHERE ura.user_id = _user_id AND ura.recipe_id = r.id AND ura.is_allowed = true)) DESC,
    -- Prefer LOW glycemic
    CASE r.glycemic_impact WHEN 'LOW' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
    -- Deprioritize "limit" recipes
    (EXISTS (SELECT 1 FROM public.recipe_conditions rc WHERE rc.recipe_id = r.id AND rc.condition_id = ANY(_conditions) AND rc.severity = 'limit')) ASC
  LIMIT _limit;
END;
$$;

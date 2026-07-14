
-- 1. Modules
CREATE TABLE public.color_gauge_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_key text NOT NULL UNIQUE,
  module_name text NOT NULL,
  description text,
  unit text,
  higher_is_better boolean NOT NULL DEFAULT true,
  comparison_mode text NOT NULL DEFAULT 'absolute', -- 'absolute' or 'delta_vs_baseline' or 'percent_of_baseline'
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.color_gauge_modules TO authenticated, anon;
GRANT ALL ON public.color_gauge_modules TO service_role;
ALTER TABLE public.color_gauge_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view gauge modules" ON public.color_gauge_modules
  FOR SELECT USING (true);
CREATE POLICY "Admins manage gauge modules" ON public.color_gauge_modules
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_color_gauge_modules_updated_at
  BEFORE UPDATE ON public.color_gauge_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Bands
CREATE TABLE public.color_gauge_bands (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id uuid NOT NULL REFERENCES public.color_gauge_modules(id) ON DELETE CASCADE,
  label text NOT NULL,
  min_value numeric,
  max_value numeric,
  color_hex text NOT NULL DEFAULT '#10B981',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_color_gauge_bands_module ON public.color_gauge_bands(module_id, sort_order);

GRANT SELECT ON public.color_gauge_bands TO authenticated, anon;
GRANT ALL ON public.color_gauge_bands TO service_role;
ALTER TABLE public.color_gauge_bands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view gauge bands" ON public.color_gauge_bands
  FOR SELECT USING (true);
CREATE POLICY "Admins manage gauge bands" ON public.color_gauge_bands
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_color_gauge_bands_updated_at
  BEFORE UPDATE ON public.color_gauge_bands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Seed modules + bands
WITH ins AS (
  INSERT INTO public.color_gauge_modules (module_key, module_name, description, unit, higher_is_better, comparison_mode, sort_order) VALUES
    ('health_score',     'Health Score',            'Overall health analysis score shown on Home',   '%',      true,  'absolute', 10),
    ('weight_bmi',       'Weight (BMI)',            'BMI category color used for weight ring',        'kg/m²',  false, 'absolute', 20),
    ('blood_sugar_fasting','Blood Sugar (Fasting)', 'Fasting glucose ring color',                     'mg/dL',  false, 'absolute', 30),
    ('hba1c',            'HbA1c',                   'HbA1c band color',                               '%',      false, 'absolute', 40),
    ('bp_systolic',      'Blood Pressure — Systolic','Systolic BP band color',                        'mmHg',   false, 'absolute', 50),
    ('bp_diastolic',     'Blood Pressure — Diastolic','Diastolic BP band color',                      'mmHg',   false, 'absolute', 60),
    ('steps_daily',      'Steps per day',           'Daily step count band color',                    'steps',  true,  'absolute', 70),
    ('sleep_hours',      'Sleep',                   'Hours of sleep band color',                      'hours',  true,  'absolute', 80),
    ('stress_level',     'Stress Level',            'Perceived stress band color (1 low – 10 high)',  'level',  false, 'absolute', 90)
  RETURNING id, module_key
)
INSERT INTO public.color_gauge_bands (module_id, label, min_value, max_value, color_hex, sort_order)
SELECT i.id, b.label, b.min_v, b.max_v, b.color, b.sort
FROM ins i
JOIN (VALUES
  -- Health Score
  ('health_score',     'Excellent',   75, 100, '#10B981', 1),
  ('health_score',     'Attention',   50, 74,  '#F59E0B', 2),
  ('health_score',     'Critical',    0,  49,  '#E63946', 3),
  -- Weight BMI
  ('weight_bmi',       'Healthy',     18.5, 24.9, '#10B981', 1),
  ('weight_bmi',       'Overweight',  25,   29.9, '#F59E0B', 2),
  ('weight_bmi',       'Obese I',     30,   34.9, '#E63946', 3),
  ('weight_bmi',       'Obese II+',   35,   80,   '#7F1D1D', 4),
  -- Fasting glucose
  ('blood_sugar_fasting','Normal',    70,   99,   '#10B981', 1),
  ('blood_sugar_fasting','Pre-diabetic',100, 125, '#F59E0B', 2),
  ('blood_sugar_fasting','Diabetic',  126,  180,  '#E63946', 3),
  ('blood_sugar_fasting','Very high', 181,  400,  '#7F1D1D', 4),
  -- HbA1c
  ('hba1c',            'Normal',      3,    5.6,  '#10B981', 1),
  ('hba1c',            'Pre-diabetic',5.7,  6.4,  '#F59E0B', 2),
  ('hba1c',            'Diabetic',    6.5,  7.9,  '#E63946', 3),
  ('hba1c',            'Very high',   8,    14,   '#7F1D1D', 4),
  -- BP systolic
  ('bp_systolic',      'Normal',      90,   119,  '#10B981', 1),
  ('bp_systolic',      'Elevated',    120,  129,  '#F59E0B', 2),
  ('bp_systolic',      'Stage 1',     130,  139,  '#E63946', 3),
  ('bp_systolic',      'Stage 2+',    140,  220,  '#7F1D1D', 4),
  -- BP diastolic
  ('bp_diastolic',     'Normal',      60,   79,   '#10B981', 1),
  ('bp_diastolic',     'Stage 1',     80,   89,   '#F59E0B', 2),
  ('bp_diastolic',     'Stage 2',     90,   99,   '#E63946', 3),
  ('bp_diastolic',     'Crisis',      100,  140,  '#7F1D1D', 4),
  -- Steps
  ('steps_daily',      'Excellent',   10000, 100000, '#10B981', 1),
  ('steps_daily',      'Good',        7500,  9999,   '#F59E0B', 2),
  ('steps_daily',      'Low',         5000,  7499,   '#E63946', 3),
  ('steps_daily',      'Sedentary',   0,     4999,   '#7F1D1D', 4),
  -- Sleep
  ('sleep_hours',      'Optimal',     7,     9,      '#10B981', 1),
  ('sleep_hours',      'Borderline',  6,     6.99,   '#F59E0B', 2),
  ('sleep_hours',      'Poor',        4,     5.99,   '#E63946', 3),
  ('sleep_hours',      'Critical',    0,     3.99,   '#7F1D1D', 4),
  -- Stress
  ('stress_level',     'Low',         1,     3,      '#10B981', 1),
  ('stress_level',     'Moderate',    4,     6,      '#F59E0B', 2),
  ('stress_level',     'High',        7,     8,      '#E63946', 3),
  ('stress_level',     'Very high',   9,     10,     '#7F1D1D', 4)
) AS b(module_key, label, min_v, max_v, color, sort) ON b.module_key = i.module_key;

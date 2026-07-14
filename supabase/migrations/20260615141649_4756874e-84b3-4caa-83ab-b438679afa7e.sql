
CREATE TABLE public.lab_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  group_name text,
  unit text,
  ref_low numeric,
  ref_high numeric,
  direction text NOT NULL DEFAULT 'in_range' CHECK (direction IN ('higher_better','lower_better','in_range')),
  is_key_marker boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 999,
  product_codes text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lab_parameters TO authenticated;
GRANT SELECT ON public.lab_parameters TO anon;
GRANT ALL ON public.lab_parameters TO service_role;
ALTER TABLE public.lab_parameters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view lab parameters"
  ON public.lab_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage lab parameters"
  ON public.lab_parameters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lab_parameters_updated BEFORE UPDATE ON public.lab_parameters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed catalog: deduplicate codes across packages
INSERT INTO public.lab_parameters (code, name, group_name, product_codes)
SELECT
  code,
  MIN(name) AS name,
  MIN(group_name) AS group_name,
  array_agg(DISTINCT product_code) AS product_codes
FROM (
  SELECT
    UPPER(TRIM(t->>'code')) AS code,
    COALESCE(NULLIF(TRIM(t->>'name'),''), TRIM(t->>'code')) AS name,
    NULLIF(TRIM(t->>'groupName'),'') AS group_name,
    tt.product_code
  FROM public.thyrocare_tests tt,
       LATERAL jsonb_array_elements(tt.raw_data->'testsIncluded') AS t
  WHERE tt.product_code IN ('PROJ1062518','PROJ1062519')
    AND COALESCE(TRIM(t->>'code'),'') <> ''
) s
GROUP BY code
ON CONFLICT (code) DO NOTHING;

-- Curated enrichment
WITH curated(code, name, unit, ref_low, ref_high, direction, is_key_marker, display_order) AS (VALUES
  ('FBS', 'Fasting Blood Sugar', 'mg/dL', 70::numeric, 100::numeric, 'lower_better', true, 1),
  ('HBA', 'HbA1c', '%', 4.0, 5.6, 'lower_better', true, 2),
  ('HBA1C', 'HbA1c', '%', 4.0, 5.6, 'lower_better', true, 2),
  ('CHOL', 'Total Cholesterol', 'mg/dL', 0, 200, 'lower_better', true, 3),
  ('LDL', 'LDL Cholesterol', 'mg/dL', 0, 100, 'lower_better', true, 4),
  ('HCHO', 'HDL Cholesterol', 'mg/dL', 40, 60, 'higher_better', true, 5),
  ('TRIG', 'Triglycerides', 'mg/dL', 0, 150, 'lower_better', true, 6),
  ('VLDL', 'VLDL Cholesterol', 'mg/dL', 0, 30, 'lower_better', false, 7),
  ('NHDL', 'Non-HDL Cholesterol', 'mg/dL', 0, 130, 'lower_better', false, 8),
  ('TC/H', 'TC / HDL Ratio', 'ratio', 0, 4.5, 'lower_better', false, 9),
  ('HD/LD', 'HDL / LDL Ratio', 'ratio', 0.3, 1, 'higher_better', false, 10),
  ('LDL/', 'LDL / HDL Ratio', 'ratio', 0, 3.5, 'lower_better', false, 11),
  ('TRI/H', 'Trig / HDL Ratio', 'ratio', 0, 3, 'lower_better', false, 12),
  ('SGPT', 'SGPT (ALT)', 'U/L', 0, 50, 'lower_better', true, 13),
  ('SGOT', 'SGOT (AST)', 'U/L', 0, 50, 'lower_better', false, 14),
  ('SCRE', 'Creatinine', 'mg/dL', 0.7, 1.3, 'in_range', true, 15),
  ('UALB', 'Urine Albumin', 'mg/L', 0, 30, 'lower_better', false, 16),
  ('TSH', 'TSH', 'µIU/mL', 0.4, 4.5, 'in_range', true, 17),
  ('T3', 'Total T3', 'ng/dL', 80, 200, 'in_range', false, 18),
  ('T4', 'Total T4', 'µg/dL', 5, 12, 'in_range', false, 19),
  ('FT3', 'Free T3', 'pg/mL', 2.3, 4.2, 'in_range', false, 20),
  ('FT4', 'Free T4', 'ng/dL', 0.8, 1.8, 'in_range', false, 21),
  ('VITD', 'Vitamin D (25-OH)', 'ng/mL', 30, 100, 'higher_better', true, 22),
  ('25OHD', 'Vitamin D (25-OH)', 'ng/mL', 30, 100, 'higher_better', true, 22),
  ('VITD3', 'Vitamin D3', 'ng/mL', 30, 100, 'higher_better', false, 23),
  ('VITB12', 'Vitamin B12', 'pg/mL', 200, 900, 'higher_better', true, 24),
  ('B12', 'Vitamin B12', 'pg/mL', 200, 900, 'higher_better', true, 24),
  ('HB', 'Hemoglobin', 'g/dL', 12, 17, 'in_range', false, 25),
  ('UREA', 'Urea', 'mg/dL', 15, 45, 'in_range', false, 26),
  ('URIC', 'Uric Acid', 'mg/dL', 3.5, 7.2, 'lower_better', false, 27),
  ('CALC', 'Calcium', 'mg/dL', 8.5, 10.5, 'in_range', false, 28),
  ('GGT', 'GGT', 'U/L', 0, 55, 'lower_better', false, 29),
  ('ALP', 'Alkaline Phosphatase', 'U/L', 40, 130, 'in_range', false, 30),
  ('TBIL', 'Total Bilirubin', 'mg/dL', 0.1, 1.2, 'lower_better', false, 31),
  ('ALB', 'Albumin', 'g/dL', 3.5, 5.5, 'in_range', false, 32),
  ('TP', 'Total Protein', 'g/dL', 6.0, 8.3, 'in_range', false, 33),
  ('IRON', 'Iron', 'µg/dL', 60, 170, 'in_range', false, 34),
  ('FERR', 'Ferritin', 'ng/mL', 30, 300, 'in_range', false, 35),
  ('TIBC', 'TIBC', 'µg/dL', 240, 450, 'in_range', false, 36),
  ('HSCRP', 'hs-CRP', 'mg/L', 0, 3, 'lower_better', false, 37),
  ('CRP', 'CRP', 'mg/L', 0, 5, 'lower_better', false, 38),
  ('INSF', 'Fasting Insulin', 'µIU/mL', 2, 25, 'in_range', false, 39),
  ('HOMA', 'HOMA-IR', 'index', 0, 2.5, 'lower_better', false, 40)
)
INSERT INTO public.lab_parameters (code, name, unit, ref_low, ref_high, direction, is_key_marker, display_order)
SELECT code, name, unit, ref_low, ref_high, direction, is_key_marker, display_order FROM curated
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    unit = EXCLUDED.unit,
    ref_low = EXCLUDED.ref_low,
    ref_high = EXCLUDED.ref_high,
    direction = EXCLUDED.direction,
    is_key_marker = EXCLUDED.is_key_marker,
    display_order = EXCLUDED.display_order;

-- LAB RESULTS
CREATE TABLE public.lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id uuid REFERENCES public.thyrocare_reports(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.thyrocare_orders(id) ON DELETE CASCADE,
  parameter_code text NOT NULL,
  parameter_name text NOT NULL,
  value_numeric numeric,
  value_text text,
  unit text,
  ref_low numeric,
  ref_high numeric,
  status text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  is_baseline boolean NOT NULL DEFAULT false,
  delta_vs_baseline numeric,
  delta_vs_previous numeric,
  trend text,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lab_results_user_param ON public.lab_results(user_id, parameter_code, observed_at);
CREATE INDEX idx_lab_results_report ON public.lab_results(report_id);
CREATE INDEX idx_lab_results_order ON public.lab_results(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_results TO authenticated;
GRANT ALL ON public.lab_results TO service_role;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own results"
  ON public.lab_results FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Coaches view assigned results"
  ON public.lab_results FOR SELECT TO authenticated
  USING (public.coach_owns_patient(user_id));
CREATE POLICY "Coaches manage assigned results"
  ON public.lab_results FOR ALL TO authenticated
  USING (public.coach_owns_patient(user_id))
  WITH CHECK (public.coach_owns_patient(user_id));
CREATE POLICY "Admins manage all results"
  ON public.lab_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_lab_results_updated BEFORE UPDATE ON public.lab_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.lab_results_compute_deltas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _baseline numeric;
  _previous numeric;
  _direction text;
  _mid numeric;
BEGIN
  IF NEW.value_numeric IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT direction INTO _direction FROM public.lab_parameters WHERE code = NEW.parameter_code;
  IF _direction IS NULL THEN _direction := 'in_range'; END IF;

  SELECT value_numeric INTO _baseline
  FROM public.lab_results
  WHERE user_id = NEW.user_id
    AND parameter_code = NEW.parameter_code
    AND value_numeric IS NOT NULL
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ORDER BY observed_at ASC, created_at ASC
  LIMIT 1;

  SELECT value_numeric INTO _previous
  FROM public.lab_results
  WHERE user_id = NEW.user_id
    AND parameter_code = NEW.parameter_code
    AND value_numeric IS NOT NULL
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND observed_at <= NEW.observed_at
  ORDER BY observed_at DESC, created_at DESC
  LIMIT 1;

  IF _baseline IS NULL THEN
    NEW.is_baseline := true;
    NEW.delta_vs_baseline := 0;
    NEW.delta_vs_previous := 0;
    NEW.trend := 'baseline';
  ELSE
    NEW.is_baseline := false;
    NEW.delta_vs_baseline := NEW.value_numeric - _baseline;
    NEW.delta_vs_previous := NEW.value_numeric - COALESCE(_previous, _baseline);

    IF NEW.delta_vs_previous = 0 THEN
      NEW.trend := 'stable';
    ELSIF _direction = 'higher_better' THEN
      NEW.trend := CASE WHEN NEW.delta_vs_previous > 0 THEN 'improving' ELSE 'worsening' END;
    ELSIF _direction = 'lower_better' THEN
      NEW.trend := CASE WHEN NEW.delta_vs_previous < 0 THEN 'improving' ELSE 'worsening' END;
    ELSE
      IF NEW.ref_low IS NOT NULL AND NEW.ref_high IS NOT NULL THEN
        _mid := (NEW.ref_low + NEW.ref_high)/2;
        NEW.trend := CASE WHEN ABS(NEW.value_numeric - _mid) < ABS(COALESCE(_previous,_baseline) - _mid)
                          THEN 'improving' ELSE 'worsening' END;
      ELSE
        NEW.trend := 'stable';
      END IF;
    END IF;
  END IF;

  IF NEW.ref_low IS NOT NULL AND NEW.value_numeric < NEW.ref_low THEN
    NEW.status := 'low';
  ELSIF NEW.ref_high IS NOT NULL AND NEW.value_numeric > NEW.ref_high THEN
    NEW.status := 'high';
  ELSE
    NEW.status := 'normal';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lab_results_compute_deltas
  BEFORE INSERT OR UPDATE OF value_numeric, observed_at, ref_low, ref_high
  ON public.lab_results
  FOR EACH ROW EXECUTE FUNCTION public.lab_results_compute_deltas();

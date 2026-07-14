
-- =========================================================
-- 1. supplement_categories master table
-- =========================================================
CREATE TABLE public.supplement_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.supplement_categories TO authenticated;
GRANT ALL ON public.supplement_categories TO service_role;

ALTER TABLE public.supplement_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplement_categories readable by authenticated"
  ON public.supplement_categories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "supplement_categories admin write"
  ON public.supplement_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER supplement_categories_updated_at
  BEFORE UPDATE ON public.supplement_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2. supplement_conditions master table
-- =========================================================
CREATE TABLE public.supplement_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.supplement_conditions TO authenticated;
GRANT ALL ON public.supplement_conditions TO service_role;

ALTER TABLE public.supplement_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplement_conditions readable by authenticated"
  ON public.supplement_conditions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "supplement_conditions admin write"
  ON public.supplement_conditions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER supplement_conditions_updated_at
  BEFORE UPDATE ON public.supplement_conditions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 3. Seed from existing sources
-- =========================================================
-- Categories: from supplement_master + prior app_settings
INSERT INTO public.supplement_categories (key, label)
SELECT k, initcap(replace(k, '_', ' '))
FROM (
  SELECT DISTINCT lower(trim(category)) AS k FROM public.supplement_master
   WHERE category IS NOT NULL AND trim(category) <> ''
  UNION
  SELECT unnest(ARRAY['booster','herbal','metabolic','vitamin & mineral']) AS k
) s
WHERE k IS NOT NULL AND k <> ''
ON CONFLICT (key) DO NOTHING;

-- Conditions: from supplement_condition_rules + prior curated set
INSERT INTO public.supplement_conditions (key, label, icon)
SELECT k, lbl, icn
FROM (
  VALUES
    ('insulin_resistance', 'Insulin Resistance',      '🩸'),
    ('ir_stress',          'IR / Stress',             '⚡'),
    ('thyroid',            'Thyroid',                 '🦋'),
    ('liver',              'Liver / Fatty Liver',     '🫀'),
    ('uric_acid',          'High Uric Acid',          '💧'),
    ('deficiency',         'Deficiency',              '🩺'),
    ('foundational',       'Foundational',            '🌿'),
    ('metabolic_boost',    'Metabolic Boost',         '🔥'),
    ('low_iron',           'Iron Deficiency / Low RBC','🩺'),
    ('gut_issues',         'Poor Gut Health & Bloating','🩺')
) AS seed(k, lbl, icn)
ON CONFLICT (key) DO NOTHING;

-- Also pull in any condition keys currently referenced by rules but not in the curated list
INSERT INTO public.supplement_conditions (key, label)
SELECT DISTINCT r.condition, initcap(replace(r.condition, '_', ' '))
FROM public.supplement_condition_rules r
WHERE r.condition IS NOT NULL
  AND r.condition NOT IN (SELECT key FROM public.supplement_conditions)
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- 4. Rename + safe-delete RPCs (admin only)
-- =========================================================
CREATE OR REPLACE FUNCTION public.rename_supplement_category(
  _old_key text, _new_key text, _new_label text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _ok text := lower(trim(_old_key));
  _nk text := lower(trim(_new_key));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can rename categories' USING ERRCODE = '42501';
  END IF;
  IF _ok = '' OR _nk = '' THEN
    RAISE EXCEPTION 'Category key cannot be empty';
  END IF;

  IF _nk <> _ok AND EXISTS (SELECT 1 FROM public.supplement_categories WHERE key = _nk) THEN
    RAISE EXCEPTION 'A category with that key already exists';
  END IF;

  UPDATE public.supplement_categories
     SET key = _nk,
         label = COALESCE(NULLIF(trim(_new_label), ''), label),
         updated_at = now()
   WHERE key = _ok;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  IF _nk <> _ok THEN
    UPDATE public.supplement_master SET category = _nk WHERE category = _ok;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_supplement_category(_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _k text := lower(trim(_key));
  _cnt int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can delete categories' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO _cnt FROM public.supplement_master WHERE category = _k;
  IF _cnt > 0 THEN
    RAISE EXCEPTION 'Cannot delete: % supplement(s) still use this category. Reassign or rename instead.', _cnt;
  END IF;

  DELETE FROM public.supplement_categories WHERE key = _k;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rename_supplement_condition(
  _old_key text, _new_key text, _new_label text DEFAULT NULL, _new_icon text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _ok text := lower(trim(_old_key));
  _nk text := lower(trim(_new_key));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can rename conditions' USING ERRCODE = '42501';
  END IF;
  IF _ok = '' OR _nk = '' THEN
    RAISE EXCEPTION 'Condition key cannot be empty';
  END IF;

  IF _nk <> _ok AND EXISTS (SELECT 1 FROM public.supplement_conditions WHERE key = _nk) THEN
    RAISE EXCEPTION 'A condition with that key already exists';
  END IF;

  UPDATE public.supplement_conditions
     SET key = _nk,
         label = COALESCE(NULLIF(trim(_new_label), ''), label),
         icon = COALESCE(NULLIF(trim(_new_icon), ''), icon),
         updated_at = now()
   WHERE key = _ok;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Condition not found';
  END IF;

  IF _nk <> _ok THEN
    UPDATE public.supplement_condition_rules SET condition = _nk WHERE condition = _ok;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_supplement_condition(_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _k text := lower(trim(_key));
  _cnt int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can delete conditions' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO _cnt FROM public.supplement_condition_rules WHERE condition = _k;
  IF _cnt > 0 THEN
    RAISE EXCEPTION 'Cannot delete: % rule(s) still reference this condition. Remove the rules or rename instead.', _cnt;
  END IF;

  DELETE FROM public.supplement_conditions WHERE key = _k;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Condition not found';
  END IF;
END;
$$;

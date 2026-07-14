
-- 1. Add gram weight for household measures
ALTER TABLE public.food_items
  ADD COLUMN IF NOT EXISTS household_grams NUMERIC;

-- 2. Backfill: parse "~Ng" / "Ng" / "(~Ng)" patterns from household_measure
UPDATE public.food_items
SET household_grams = CAST(
  (regexp_match(household_measure, '~?\s*([0-9]+(?:\.[0-9]+)?)\s*g'))[1] AS NUMERIC
)
WHERE household_grams IS NULL
  AND household_measure ~* '[0-9]+\s*g';

-- Fallback for ml-based measures (treat ml ≈ g for water-based foods)
UPDATE public.food_items
SET household_grams = CAST(
  (regexp_match(household_measure, '~?\s*([0-9]+(?:\.[0-9]+)?)\s*ml'))[1] AS NUMERIC
)
WHERE household_grams IS NULL
  AND household_measure ~* '[0-9]+\s*ml';

-- Default remaining rows: assume 1 katori / 1 piece ≈ 100g (matches per_100g basis)
UPDATE public.food_items
SET household_grams = 100
WHERE household_grams IS NULL;

-- 3. Fix Pearl Millet bad copy ("1 medium fruit" → proper grain measure)
UPDATE public.food_items
SET household_measure = '1 katori cooked (~150g)',
    serving_label = '1 katori cooked (~150g)',
    household_grams = 150
WHERE name ILIKE 'pearl millet';

-- 4. Dedupe Paneer: keep one canonical row (USDA-aligned: 265 kcal/100g, 18g protein, 20g fat)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY LOWER(name), filter_id ORDER BY created_at ASC) rn
  FROM public.food_items
  WHERE LOWER(name) = 'paneer'
)
UPDATE public.food_items SET is_active = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

UPDATE public.food_items
SET calories_kcal = 265, protein_g = 18, fat_g = 20,
    carbs_min = 3, carbs_max = 4, fiber_g = 0,
    household_measure = '1 small piece (~50g)',
    serving_label = '1 small piece (~50g)',
    household_grams = 50
WHERE LOWER(name) = 'paneer' AND is_active = true;

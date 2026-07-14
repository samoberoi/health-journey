
ALTER TABLE public.food_items
  ADD COLUMN IF NOT EXISTS serving_size_qty NUMERIC,
  ADD COLUMN IF NOT EXISTS serving_size_unit TEXT,
  ADD COLUMN IF NOT EXISTS serving_label TEXT,
  ADD COLUMN IF NOT EXISTS household_measure TEXT;

-- Backfill sensible defaults based on existing serving_basis
UPDATE public.food_items
SET
  serving_size_qty = CASE
    WHEN serving_basis::text IN ('per_100g','cooked','raw') THEN 100
    WHEN serving_basis::text = 'per_100ml' THEN 100
    ELSE 100
  END,
  serving_size_unit = CASE
    WHEN serving_basis::text = 'per_100ml' THEN 'ml'
    ELSE 'g'
  END
WHERE serving_size_qty IS NULL;

-- Default human-readable label
UPDATE public.food_items
SET serving_label = serving_size_qty::text || ' ' || serving_size_unit
WHERE serving_label IS NULL;

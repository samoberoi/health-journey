
-- Multi-select diet preferences
ALTER TABLE public.user_diet_profiles
  ADD COLUMN IF NOT EXISTS diet_preferences TEXT[] NOT NULL DEFAULT '{}'::text[];

-- Backfill from the legacy single column
UPDATE public.user_diet_profiles
SET diet_preferences = ARRAY[diet_preference]
WHERE (diet_preferences IS NULL OR array_length(diet_preferences, 1) IS NULL)
  AND diet_preference IS NOT NULL
  AND diet_preference <> '';

-- Per-item image URL (AI-generated, lazily filled)
ALTER TABLE public.food_items
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Plate snapshot picture
ALTER TABLE public.user_plates
  ADD COLUMN IF NOT EXISTS snapshot_url TEXT;

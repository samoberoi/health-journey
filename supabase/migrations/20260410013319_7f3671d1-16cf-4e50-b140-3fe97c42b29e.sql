
ALTER TABLE public.recipes
  ADD COLUMN ingredients JSONB DEFAULT '[]',
  ADD COLUMN steps TEXT[] DEFAULT '{}',
  ADD COLUMN prep_time_mins INTEGER,
  ADD COLUMN cook_time_mins INTEGER,
  ADD COLUMN servings INTEGER DEFAULT 1,
  ADD COLUMN serving_size TEXT;

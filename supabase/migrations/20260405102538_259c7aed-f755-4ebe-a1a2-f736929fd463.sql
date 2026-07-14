
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  phone text,
  name text,
  age integer,
  gender text,
  goals jsonb DEFAULT '[]'::jsonb,
  height numeric,
  weight numeric,
  bmi numeric,
  bmi_category text,
  waist numeric,
  clinical jsonb DEFAULT '{}'::jsonb,
  lifestyle jsonb DEFAULT '{}'::jsonb,
  deep_profiling jsonb DEFAULT '{}'::jsonb,
  assessment jsonb DEFAULT '{}'::jsonb,
  avatar_url text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

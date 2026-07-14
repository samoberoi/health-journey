
CREATE TABLE public.app_languages (
  code text PRIMARY KEY,
  name text NOT NULL,
  native_name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_languages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_languages TO authenticated;
GRANT ALL ON public.app_languages TO service_role;

ALTER TABLE public.app_languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view enabled languages"
ON public.app_languages FOR SELECT
USING (is_enabled = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert languages"
ON public.app_languages FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update languages"
ON public.app_languages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete languages"
ON public.app_languages FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_app_languages_updated_at
BEFORE UPDATE ON public.app_languages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_languages (code, name, native_name, is_enabled, sort_order) VALUES
  ('en', 'English',   'English',   true,  10),
  ('hi', 'Hindi',     'हिन्दी',     false, 20),
  ('ta', 'Tamil',     'தமிழ்',      false, 30),
  ('te', 'Telugu',    'తెలుగు',     false, 40),
  ('kn', 'Kannada',   'ಕನ್ನಡ',      false, 50),
  ('ml', 'Malayalam', 'മലയാളം',     false, 60),
  ('mr', 'Marathi',   'मराठी',      false, 70),
  ('bn', 'Bengali',   'বাংলা',      false, 80),
  ('gu', 'Gujarati',  'ગુજરાતી',     false, 90),
  ('pa', 'Punjabi',   'ਪੰਜਾਬੀ',     false, 100),
  ('ur', 'Urdu',      'اردو',       false, 110)
ON CONFLICT (code) DO NOTHING;

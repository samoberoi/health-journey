-- Config-driven daily goals
INSERT INTO public.app_settings (key, value) VALUES
  ('daily_exercise_goal', to_jsonb(5)),
  ('daily_yoga_minutes', to_jsonb(20))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_daily_exercise_goal()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF((value)::text, '')::numeric::integer, 5)
  FROM public.app_settings WHERE key = 'daily_exercise_goal' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_yoga_minutes()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF((value)::text, '')::numeric::integer, 20)
  FROM public.app_settings WHERE key = 'daily_yoga_minutes' LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_exercise_goal() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_yoga_minutes()  TO anon, authenticated;
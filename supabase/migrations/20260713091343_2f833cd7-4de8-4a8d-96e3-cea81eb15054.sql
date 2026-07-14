
CREATE OR REPLACE FUNCTION public.get_daily_exercise_goal()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(regexp_replace((value)::text, '[^0-9.-]', '', 'g'), '')::numeric::integer
       FROM public.app_settings WHERE key = 'exercise_daily_minutes' LIMIT 1),
    (SELECT NULLIF(regexp_replace((value)::text, '[^0-9.-]', '', 'g'), '')::numeric::integer
       FROM public.app_settings WHERE key = 'daily_exercise_goal' LIMIT 1),
    5
  );
$$;

CREATE OR REPLACE FUNCTION public.get_daily_yoga_minutes()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(regexp_replace((value)::text, '[^0-9.-]', '', 'g'), '')::numeric::integer
       FROM public.app_settings WHERE key = 'yoga_stress_daily_minutes' LIMIT 1),
    (SELECT NULLIF(regexp_replace((value)::text, '[^0-9.-]', '', 'g'), '')::numeric::integer
       FROM public.app_settings WHERE key = 'daily_yoga_minutes' LIMIT 1),
    20
  );
$$;


CREATE OR REPLACE FUNCTION public.email_exists(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(email) = lower(trim(_email))
      AND user_id <> auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.email_exists(text) TO authenticated, anon;

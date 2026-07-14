CREATE OR REPLACE FUNCTION public.link_coach_to_user(_user_id uuid, _phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _coach_id uuid;
BEGIN
  UPDATE public.coaches
     SET user_id = _user_id
   WHERE phone = _phone
     AND (user_id IS NULL OR user_id = _user_id)
     AND is_active = true
  RETURNING id INTO _coach_id;

  IF _coach_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'coach')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN _coach_id;
END;
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT c.user_id, 'coach'
FROM public.coaches c
WHERE c.user_id IS NOT NULL
  AND c.is_active = true
ON CONFLICT (user_id, role) DO NOTHING;
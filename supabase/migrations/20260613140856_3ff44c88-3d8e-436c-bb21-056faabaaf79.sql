
-- Backfill coach.user_id by matching profiles.phone
UPDATE public.coaches c
SET user_id = p.user_id
FROM public.profiles p
WHERE c.user_id IS NULL
  AND p.phone = c.phone;

-- Helper: auto-link a coach to a given auth user by phone (callable from client)
CREATE OR REPLACE FUNCTION public.link_coach_to_user(_user_id uuid, _phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  RETURN _coach_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_coach_to_user(uuid, text) TO authenticated;

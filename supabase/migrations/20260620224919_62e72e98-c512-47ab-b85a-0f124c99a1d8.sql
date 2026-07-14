
-- Backfill missing profile phone numbers from the shadow auth email ({phone}@bbd.app)
UPDATE public.profiles p
SET phone = split_part(u.email, '@', 1)
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.phone IS NULL OR p.phone = '')
  AND u.email LIKE '%@bbd.app'
  AND split_part(u.email, '@', 1) ~ '^[0-9]{10,}$';

-- Trigger to auto-populate phone on profile insert/update if blank
CREATE OR REPLACE FUNCTION public.profile_autofill_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_phone text;
BEGIN
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
    IF v_email LIKE '%@bbd.app' THEN
      v_phone := split_part(v_email, '@', 1);
      IF v_phone ~ '^[0-9]{10,}$' THEN
        NEW.phone := v_phone;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_autofill_phone ON public.profiles;
CREATE TRIGGER trg_profile_autofill_phone
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profile_autofill_phone();

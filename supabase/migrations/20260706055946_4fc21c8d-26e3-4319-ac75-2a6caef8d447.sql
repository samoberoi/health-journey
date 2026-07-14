ALTER TABLE public.channel_partners
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS experience_years integer,
  ADD COLUMN IF NOT EXISTS certifications text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS service_locations text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS pincode text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_partners TO authenticated;
GRANT ALL ON public.channel_partners TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_partner_packages TO authenticated;
GRANT ALL ON public.channel_partner_packages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_partner_slots TO authenticated;
GRANT ALL ON public.channel_partner_slots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.yoga_bookings TO authenticated;
GRANT ALL ON public.yoga_bookings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rbac_permissions TO authenticated;
GRANT ALL ON public.rbac_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

DROP POLICY IF EXISTS "Partner can update own profile" ON public.channel_partners;
CREATE POLICY "Partner can update own profile"
ON public.channel_partners
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.rbac_can(_user_id uuid, _module text, _sub_module text, _action text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _allowed BOOLEAN;
  _pkg text;
BEGIN
  IF public.has_role(_user_id, 'admin') THEN
    RETURN true;
  END IF;

  IF public.has_role(_user_id, 'coach') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.rbac_permissions p
      WHERE p.role = 'coach'::app_role
        AND p.package_key IS NULL
        AND p.module = _module
        AND (p.sub_module = _sub_module OR (p.sub_module IS NULL AND _sub_module IS NULL))
        AND (
          (_action = 'view'   AND p.can_view)   OR
          (_action = 'edit'   AND p.can_edit)   OR
          (_action = 'delete' AND p.can_delete)
        )
    ) INTO _allowed;
    RETURN COALESCE(_allowed, false);
  END IF;

  IF public.has_role(_user_id, 'channel_partner') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.rbac_permissions p
      WHERE p.role = 'channel_partner'::app_role
        AND p.package_key IS NULL
        AND p.module = _module
        AND (p.sub_module = _sub_module OR (p.sub_module IS NULL AND _sub_module IS NULL))
        AND (
          (_action = 'view'   AND p.can_view)   OR
          (_action = 'edit'   AND p.can_edit)   OR
          (_action = 'delete' AND p.can_delete)
        )
    ) INTO _allowed;
    RETURN COALESCE(_allowed, false);
  END IF;

  _pkg := public.current_user_package_key(_user_id);
  IF _pkg IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.rbac_permissions p
    WHERE p.role = 'user'::app_role
      AND p.package_key = _pkg
      AND p.module = _module
      AND (p.sub_module = _sub_module OR (p.sub_module IS NULL AND _sub_module IS NULL))
      AND (
        (_action = 'view'   AND p.can_view)   OR
        (_action = 'edit'   AND p.can_edit)   OR
        (_action = 'delete' AND p.can_delete)
      )
  ) INTO _allowed;

  RETURN COALESCE(_allowed, false);
END;
$function$;
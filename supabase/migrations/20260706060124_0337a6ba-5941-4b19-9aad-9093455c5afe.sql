ALTER TABLE public.rbac_permissions
  DROP CONSTRAINT IF EXISTS rbac_permissions_role_pkg_chk;

ALTER TABLE public.rbac_permissions
  ADD CONSTRAINT rbac_permissions_role_pkg_chk
  CHECK (
    (role = 'user'::public.app_role AND package_key IS NOT NULL)
    OR (role = ANY (ARRAY['coach'::public.app_role, 'admin'::public.app_role, 'channel_partner'::public.app_role]) AND package_key IS NULL)
  );
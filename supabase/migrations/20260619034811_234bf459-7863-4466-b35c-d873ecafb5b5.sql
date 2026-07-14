
-- Extend RBAC to support per-package scoping for end users.
ALTER TABLE public.rbac_permissions
  ADD COLUMN IF NOT EXISTS package_key text;

-- A 'user' role row is now ALWAYS scoped to a package.
-- 'coach' and 'admin' rows have package_key = NULL.
ALTER TABLE public.rbac_permissions
  DROP CONSTRAINT IF EXISTS rbac_permissions_role_pkg_chk;
ALTER TABLE public.rbac_permissions
  ADD CONSTRAINT rbac_permissions_role_pkg_chk
  CHECK (
    (role = 'user'::app_role AND package_key IS NOT NULL)
    OR (role IN ('coach'::app_role, 'admin'::app_role) AND package_key IS NULL)
  ) NOT VALID;

-- Drop legacy un-scoped 'user' rows so the new constraint can be validated.
DELETE FROM public.rbac_permissions WHERE role = 'user'::app_role AND package_key IS NULL;
ALTER TABLE public.rbac_permissions VALIDATE CONSTRAINT rbac_permissions_role_pkg_chk;

-- Replace the old unique index with one that includes package_key.
DROP INDEX IF EXISTS public.rbac_permissions_unique;
CREATE UNIQUE INDEX rbac_permissions_unique
  ON public.rbac_permissions (
    role,
    COALESCE(package_key, ''),
    module,
    COALESCE(sub_module, '')
  );

-- Resolve the active package_key for a user (handles legacy plan_id aliases).
CREATE OR REPLACE FUNCTION public.current_user_package_key(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE s.plan_id
    WHEN 'starter' THEN 'foundation'
    WHEN 'pro'     THEN 'intensive'
    ELSE s.plan_id
  END
  FROM public.subscriptions s
  WHERE s.user_id = _user_id
    AND s.status = 'active'
    AND s.expires_at > now()
  ORDER BY s.started_at DESC
  LIMIT 1;
$$;

-- New permission check: admin → all, coach → coach rules, user → package-scoped rules.
CREATE OR REPLACE FUNCTION public.rbac_can(_user_id uuid, _module text, _sub_module text, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

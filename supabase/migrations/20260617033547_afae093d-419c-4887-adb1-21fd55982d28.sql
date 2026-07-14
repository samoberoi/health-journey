
CREATE TABLE public.rbac_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role public.app_role NOT NULL,
  module TEXT NOT NULL,
  sub_module TEXT,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX rbac_permissions_unique
  ON public.rbac_permissions (role, module, COALESCE(sub_module, ''));

GRANT SELECT ON public.rbac_permissions TO authenticated;
GRANT ALL ON public.rbac_permissions TO service_role;

ALTER TABLE public.rbac_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read permissions"
  ON public.rbac_permissions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage permissions insert"
  ON public.rbac_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage permissions update"
  ON public.rbac_permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage permissions delete"
  ON public.rbac_permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER rbac_permissions_updated_at
  BEFORE UPDATE ON public.rbac_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.rbac_can(_user_id UUID, _module TEXT, _sub_module TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed BOOLEAN;
BEGIN
  IF public.has_role(_user_id, 'admin') THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.rbac_permissions p ON p.role = ur.role
    WHERE ur.user_id = _user_id
      AND p.module = _module
      AND (p.sub_module = _sub_module OR (p.sub_module IS NULL AND _sub_module IS NULL))
      AND (
        (_action = 'view' AND p.can_view) OR
        (_action = 'edit' AND p.can_edit) OR
        (_action = 'delete' AND p.can_delete)
      )
  ) INTO _allowed;

  RETURN COALESCE(_allowed, false);
END;
$$;

-- Seed super admin (admin role) with full access at module level
INSERT INTO public.rbac_permissions (role, module, sub_module, can_view, can_edit, can_delete) VALUES
  ('admin', 'overview', NULL, true, true, true),
  ('admin', 'users', NULL, true, true, true),
  ('admin', 'coaches', NULL, true, true, true),
  ('admin', 'diet', NULL, true, true, true),
  ('admin', 'supplements', NULL, true, true, true),
  ('admin', 'fasting', NULL, true, true, true),
  ('admin', 'lab_tests', NULL, true, true, true),
  ('admin', 'exercises', NULL, true, true, true),
  ('admin', 'control_center', NULL, true, true, true)
ON CONFLICT DO NOTHING;

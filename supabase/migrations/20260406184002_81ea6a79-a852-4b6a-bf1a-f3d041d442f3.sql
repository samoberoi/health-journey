
-- Supplement master catalog
CREATE TABLE public.supplement_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'vitamin',
  description text,
  default_dosage text,
  default_frequency text DEFAULT 'once daily',
  default_timing text DEFAULT 'with meal',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplement_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view active supplements" ON public.supplement_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage supplements" ON public.supplement_master FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert supplements" ON public.supplement_master FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Condition-based dosage rules
CREATE TABLE public.supplement_condition_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplement_id uuid NOT NULL REFERENCES public.supplement_master(id) ON DELETE CASCADE,
  condition text NOT NULL,
  severity text NOT NULL DEFAULT 'moderate',
  dosage text NOT NULL,
  frequency text NOT NULL DEFAULT 'once daily',
  duration_weeks integer NOT NULL DEFAULT 12,
  timing text DEFAULT 'with meal',
  remarks text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplement_condition_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view rules" ON public.supplement_condition_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage rules" ON public.supplement_condition_rules FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert rules" ON public.supplement_condition_rules FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- User supplement plans (coach assigns)
CREATE TABLE public.user_supplement_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assigned_by uuid,
  plan_name text NOT NULL DEFAULT 'Custom Plan',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  duration_weeks integer NOT NULL DEFAULT 12,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_supplement_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own plans" ON public.user_supplement_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Coaches can view patient plans" ON public.user_supplement_plans FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) AND EXISTS (
    SELECT 1 FROM coach_assignments ca JOIN coaches c ON c.id = ca.coach_id
    WHERE ca.user_id = user_supplement_plans.user_id AND ca.is_active = true AND c.user_id = auth.uid()
  ));
CREATE POLICY "Coaches can insert patient plans" ON public.user_supplement_plans FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'coach'::app_role) AND EXISTS (
    SELECT 1 FROM coach_assignments ca JOIN coaches c ON c.id = ca.coach_id
    WHERE ca.user_id = user_supplement_plans.user_id AND ca.is_active = true AND c.user_id = auth.uid()
  ));
CREATE POLICY "Coaches can update patient plans" ON public.user_supplement_plans FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) AND EXISTS (
    SELECT 1 FROM coach_assignments ca JOIN coaches c ON c.id = ca.coach_id
    WHERE ca.user_id = user_supplement_plans.user_id AND ca.is_active = true AND c.user_id = auth.uid()
  ));
CREATE POLICY "Admins can manage all plans" ON public.user_supplement_plans FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Plan line items
CREATE TABLE public.user_supplement_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.user_supplement_plans(id) ON DELETE CASCADE,
  supplement_id uuid NOT NULL REFERENCES public.supplement_master(id) ON DELETE CASCADE,
  dosage text NOT NULL,
  frequency text NOT NULL DEFAULT 'once daily',
  timing text DEFAULT 'with meal',
  remarks text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_supplement_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own plan items" ON public.user_supplement_plan_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_supplement_plans p WHERE p.id = user_supplement_plan_items.plan_id AND p.user_id = auth.uid()));
CREATE POLICY "Coaches can view patient plan items" ON public.user_supplement_plan_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) AND EXISTS (
    SELECT 1 FROM user_supplement_plans p JOIN coach_assignments ca ON ca.user_id = p.user_id
    JOIN coaches c ON c.id = ca.coach_id
    WHERE p.id = user_supplement_plan_items.plan_id AND ca.is_active = true AND c.user_id = auth.uid()
  ));
CREATE POLICY "Coaches can insert plan items" ON public.user_supplement_plan_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'coach'::app_role) AND EXISTS (
    SELECT 1 FROM user_supplement_plans p JOIN coach_assignments ca ON ca.user_id = p.user_id
    JOIN coaches c ON c.id = ca.coach_id
    WHERE p.id = user_supplement_plan_items.plan_id AND ca.is_active = true AND c.user_id = auth.uid()
  ));
CREATE POLICY "Coaches can update plan items" ON public.user_supplement_plan_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) AND EXISTS (
    SELECT 1 FROM user_supplement_plans p JOIN coach_assignments ca ON ca.user_id = p.user_id
    JOIN coaches c ON c.id = ca.coach_id
    WHERE p.id = user_supplement_plan_items.plan_id AND ca.is_active = true AND c.user_id = auth.uid()
  ));
CREATE POLICY "Admins can manage all plan items" ON public.user_supplement_plan_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Daily tracking
CREATE TABLE public.user_supplement_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_item_id uuid NOT NULL REFERENCES public.user_supplement_plan_items(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  taken boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, plan_item_id, date)
);
ALTER TABLE public.user_supplement_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tracking" ON public.user_supplement_tracking FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tracking" ON public.user_supplement_tracking FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tracking" ON public.user_supplement_tracking FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Coaches can view patient tracking" ON public.user_supplement_tracking FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) AND EXISTS (
    SELECT 1 FROM coach_assignments ca JOIN coaches c ON c.id = ca.coach_id
    WHERE ca.user_id = user_supplement_tracking.user_id AND ca.is_active = true AND c.user_id = auth.uid()
  ));
CREATE POLICY "Admins can view all tracking" ON public.user_supplement_tracking FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_supplement_master_updated_at BEFORE UPDATE ON public.supplement_master FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_user_supplement_plans_updated_at BEFORE UPDATE ON public.user_supplement_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();

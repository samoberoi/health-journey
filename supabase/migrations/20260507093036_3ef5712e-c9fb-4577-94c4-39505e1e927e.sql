
-- Catalog of Thyrocare tests (synced from API)
CREATE TABLE public.thyrocare_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_code TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  product_type TEXT,
  category TEXT,
  rate NUMERIC(10,2),
  offer_rate NUMERIC(10,2),
  fasting_required BOOLEAN DEFAULT false,
  fasting_hours INTEGER,
  parameters_count INTEGER,
  description TEXT,
  raw_data JSONB,
  is_active BOOLEAN DEFAULT true,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_thyrocare_tests_active ON public.thyrocare_tests(is_active);
CREATE INDEX idx_thyrocare_tests_category ON public.thyrocare_tests(category);

ALTER TABLE public.thyrocare_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view active tests" ON public.thyrocare_tests
  FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins manage tests" ON public.thyrocare_tests
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Coach recommendations
CREATE TABLE public.thyrocare_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  coach_id UUID,
  test_ids UUID[] NOT NULL DEFAULT '{}',
  product_codes TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','viewed','booked','dismissed')),
  recommended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_thy_rec_user ON public.thyrocare_recommendations(user_id);
CREATE INDEX idx_thy_rec_coach ON public.thyrocare_recommendations(coach_id);

ALTER TABLE public.thyrocare_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients view own recs" ON public.thyrocare_recommendations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Patients update own recs status" ON public.thyrocare_recommendations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Coaches view assigned patient recs" ON public.thyrocare_recommendations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.coach_assignments ca
      JOIN public.coaches c ON c.id = ca.coach_id
      WHERE ca.user_id = thyrocare_recommendations.user_id
        AND c.user_id = auth.uid()
        AND ca.is_active = true
    )
  );
CREATE POLICY "Coaches create recs for assigned patients" ON public.thyrocare_recommendations
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coach_assignments ca
      JOIN public.coaches c ON c.id = ca.coach_id
      WHERE ca.user_id = thyrocare_recommendations.user_id
        AND c.user_id = auth.uid()
        AND ca.is_active = true
    )
  );
CREATE POLICY "Coaches update assigned recs" ON public.thyrocare_recommendations
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.coach_assignments ca
      JOIN public.coaches c ON c.id = ca.coach_id
      WHERE ca.user_id = thyrocare_recommendations.user_id
        AND c.user_id = auth.uid()
        AND ca.is_active = true
    )
  );
CREATE POLICY "Admins all recs" ON public.thyrocare_recommendations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Orders placed via Thyrocare
CREATE TABLE public.thyrocare_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recommendation_id UUID REFERENCES public.thyrocare_recommendations(id) ON DELETE SET NULL,
  thyrocare_order_id TEXT,
  thyrocare_lead_id TEXT,
  product_codes TEXT[] NOT NULL DEFAULT '{}',
  beneficiary_name TEXT NOT NULL,
  beneficiary_age INTEGER,
  beneficiary_gender TEXT,
  mobile TEXT NOT NULL,
  email TEXT,
  pincode TEXT NOT NULL,
  address TEXT,
  collection_date DATE,
  collection_slot TEXT,
  amount NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'created',
  status_detail TEXT,
  raw_request JSONB,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_thy_orders_user ON public.thyrocare_orders(user_id);
CREATE INDEX idx_thy_orders_status ON public.thyrocare_orders(status);
CREATE INDEX idx_thy_orders_thy_id ON public.thyrocare_orders(thyrocare_order_id);

ALTER TABLE public.thyrocare_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients view own orders" ON public.thyrocare_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Patients create own orders" ON public.thyrocare_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Coaches view assigned orders" ON public.thyrocare_orders
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.coach_assignments ca
      JOIN public.coaches c ON c.id = ca.coach_id
      WHERE ca.user_id = thyrocare_orders.user_id
        AND c.user_id = auth.uid()
        AND ca.is_active = true
    )
  );
CREATE POLICY "Admins all orders" ON public.thyrocare_orders
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reports for orders
CREATE TABLE public.thyrocare_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.thyrocare_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  report_url TEXT,
  report_type TEXT,
  parameters JSONB,
  delivered_at TIMESTAMPTZ DEFAULT now(),
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_thy_reports_order ON public.thyrocare_reports(order_id);
CREATE INDEX idx_thy_reports_user ON public.thyrocare_reports(user_id);

ALTER TABLE public.thyrocare_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients view own reports" ON public.thyrocare_reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Coaches view assigned reports" ON public.thyrocare_reports
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.coach_assignments ca
      JOIN public.coaches c ON c.id = ca.coach_id
      WHERE ca.user_id = thyrocare_reports.user_id
        AND c.user_id = auth.uid()
        AND ca.is_active = true
    )
  );
CREATE POLICY "Admins all reports" ON public.thyrocare_reports
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Webhook event log (service-role only)
CREATE TABLE public.thyrocare_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT,
  thyrocare_order_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.thyrocare_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view webhooks" ON public.thyrocare_webhook_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auth token cache (service-role only)
CREATE TABLE public.thyrocare_auth_cache (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bearer_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.thyrocare_auth_cache ENABLE ROW LEVEL SECURITY;
-- No policies = only service role can access

-- updated_at triggers
CREATE TRIGGER trg_thy_tests_updated BEFORE UPDATE ON public.thyrocare_tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_thy_rec_updated BEFORE UPDATE ON public.thyrocare_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_thy_orders_updated BEFORE UPDATE ON public.thyrocare_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

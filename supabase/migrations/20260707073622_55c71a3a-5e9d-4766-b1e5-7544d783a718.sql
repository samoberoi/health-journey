
-- 1. Rate config row
CREATE TABLE public.pnl_rate_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gst_pct numeric(6,2) NOT NULL DEFAULT 18.00,
  hyperrevamp_pct numeric(6,2) NOT NULL DEFAULT 10.00,
  default_coach_commission_pct numeric(6,2) NOT NULL DEFAULT 10.00,
  default_partner_split_pct numeric(6,2) NOT NULL DEFAULT 80.00,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pnl_rate_config TO authenticated;
GRANT ALL ON public.pnl_rate_config TO service_role;
ALTER TABLE public.pnl_rate_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read pnl config"
  ON public.pnl_rate_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert pnl config"
  ON public.pnl_rate_config FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can update pnl config"
  ON public.pnl_rate_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.pnl_rate_config DEFAULT VALUES;

CREATE TRIGGER trg_pnl_cfg_updated BEFORE UPDATE ON public.pnl_rate_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Per-package partner split
ALTER TABLE public.channel_partner_packages
  ADD COLUMN IF NOT EXISTS partner_split_pct numeric(6,2);

-- 3. P&L compute function
CREATE OR REPLACE FUNCTION public.pnl_compute(_from timestamptz, _to timestamptz)
RETURNS TABLE (
  source text,
  ref_id uuid,
  occurred_at timestamptz,
  user_id uuid,
  label text,
  gross numeric,
  gst numeric,
  net numeric,
  coach_cost numeric,
  partner_cost numeric,
  hyperrevamp_cost numeric,
  margin numeric,
  meta jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cfg public.pnl_rate_config%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _cfg FROM public.pnl_rate_config ORDER BY created_at ASC LIMIT 1;
  IF _cfg.id IS NULL THEN
    INSERT INTO public.pnl_rate_config DEFAULT VALUES RETURNING * INTO _cfg;
  END IF;

  RETURN QUERY
  -- Subscription revenue
  SELECT
    'subscription'::text AS source,
    s.id AS ref_id,
    s.started_at AS occurred_at,
    s.user_id,
    s.plan_name AS label,
    s.plan_price::numeric AS gross,
    ROUND(s.plan_price::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct), 2) AS gst,
    ROUND(s.plan_price::numeric - (s.plan_price::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct)), 2) AS net,
    ROUND(
      CASE WHEN c.id IS NULL THEN 0
      ELSE (s.plan_price::numeric - (s.plan_price::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct)))
           * COALESCE(c.commission_percent, _cfg.default_coach_commission_pct) / 100
      END, 2) AS coach_cost,
    0::numeric AS partner_cost,
    ROUND((s.plan_price::numeric - (s.plan_price::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct)))
          * _cfg.hyperrevamp_pct / 100, 2) AS hyperrevamp_cost,
    ROUND(
      (s.plan_price::numeric - (s.plan_price::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct)))
      - ROUND((s.plan_price::numeric - (s.plan_price::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct)))
              * _cfg.hyperrevamp_pct / 100, 2)
      - CASE WHEN c.id IS NULL THEN 0
             ELSE ROUND((s.plan_price::numeric - (s.plan_price::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct)))
                        * COALESCE(c.commission_percent, _cfg.default_coach_commission_pct) / 100, 2)
        END, 2) AS margin,
    jsonb_build_object(
      'plan_id', s.plan_id,
      'coach_name', c.name,
      'coach_commission_pct', COALESCE(c.commission_percent, _cfg.default_coach_commission_pct)
    ) AS meta
  FROM public.subscriptions s
  LEFT JOIN public.coach_assignments ca ON ca.user_id = s.user_id AND ca.is_active = true
  LEFT JOIN public.coaches c ON c.id = ca.coach_id
  WHERE s.started_at >= _from AND s.started_at < _to
    AND s.status IN ('active','expired')

  UNION ALL

  -- Yoga booking revenue
  SELECT
    'yoga'::text AS source,
    yb.id AS ref_id,
    yb.created_at AS occurred_at,
    yb.user_id,
    COALESCE(cpp.name, 'Yoga package') AS label,
    yb.price_inr::numeric AS gross,
    ROUND(yb.price_inr::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct), 2) AS gst,
    ROUND(yb.price_inr::numeric - (yb.price_inr::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct)), 2) AS net,
    0::numeric AS coach_cost,
    ROUND((yb.price_inr::numeric - (yb.price_inr::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct)))
          * COALESCE(cpp.partner_split_pct, _cfg.default_partner_split_pct) / 100, 2) AS partner_cost,
    ROUND((yb.price_inr::numeric - (yb.price_inr::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct)))
          * _cfg.hyperrevamp_pct / 100, 2) AS hyperrevamp_cost,
    ROUND(
      (yb.price_inr::numeric - (yb.price_inr::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct)))
      - ROUND((yb.price_inr::numeric - (yb.price_inr::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct)))
              * COALESCE(cpp.partner_split_pct, _cfg.default_partner_split_pct) / 100, 2)
      - ROUND((yb.price_inr::numeric - (yb.price_inr::numeric * _cfg.gst_pct / (100 + _cfg.gst_pct)))
              * _cfg.hyperrevamp_pct / 100, 2), 2) AS margin,
    jsonb_build_object(
      'partner_id', yb.partner_id,
      'partner_name', cp.name,
      'partner_split_pct', COALESCE(cpp.partner_split_pct, _cfg.default_partner_split_pct)
    ) AS meta
  FROM public.yoga_bookings yb
  LEFT JOIN public.channel_partner_packages cpp ON cpp.id = yb.package_id
  LEFT JOIN public.channel_partners cp ON cp.id = yb.partner_id
  WHERE yb.created_at >= _from AND yb.created_at < _to
    AND yb.payment_status = 'paid'
    AND yb.status <> 'cancelled'
  ORDER BY occurred_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pnl_compute(timestamptz, timestamptz) TO authenticated;

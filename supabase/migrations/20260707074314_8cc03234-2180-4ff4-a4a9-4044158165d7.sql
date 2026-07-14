
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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cfg public.pnl_rate_config%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO _cfg FROM public.pnl_rate_config ORDER BY created_at ASC LIMIT 1;
  IF _cfg.id IS NULL THEN
    INSERT INTO public.pnl_rate_config DEFAULT VALUES RETURNING * INTO _cfg;
  END IF;

  RETURN QUERY
  -- SUBSCRIPTIONS
  SELECT
    'subscription'::text                                    AS source,
    s.id                                                    AS ref_id,
    s.created_at                                            AS occurred_at,
    s.user_id                                               AS user_id,
    COALESCE(s.plan_name, s.plan_id, 'Subscription')::text  AS label,
    COALESCE(s.plan_price, 0)::numeric                      AS gross,
    ROUND(COALESCE(s.plan_price,0)::numeric
          * _cfg.gst_pct / (100 + _cfg.gst_pct), 2)         AS gst,
    ROUND(COALESCE(s.plan_price,0)::numeric
          * 100.0 / (100 + _cfg.gst_pct), 2)                AS net,
    ROUND(
      (COALESCE(s.plan_price,0)::numeric
        * 100.0 / (100 + _cfg.gst_pct))
      * COALESCE(c.commission_percent, cm.percent, _cfg.default_coach_commission_pct) / 100.0
    , 2)                                                    AS coach_cost,
    0::numeric                                              AS partner_cost,
    ROUND(
      (COALESCE(s.plan_price,0)::numeric
        * 100.0 / (100 + _cfg.gst_pct))
      * _cfg.hyperrevamp_pct / 100.0
    , 2)                                                    AS hyperrevamp_cost,
    -- margin = net - hyperrevamp - coach
    ROUND(
      (COALESCE(s.plan_price,0)::numeric * 100.0 / (100 + _cfg.gst_pct))
      - ((COALESCE(s.plan_price,0)::numeric * 100.0 / (100 + _cfg.gst_pct)) * _cfg.hyperrevamp_pct / 100.0)
      - ((COALESCE(s.plan_price,0)::numeric * 100.0 / (100 + _cfg.gst_pct))
          * COALESCE(c.commission_percent, cm.percent, _cfg.default_coach_commission_pct) / 100.0)
    , 2)                                                    AS margin,
    jsonb_build_object(
      'plan_id', s.plan_id,
      'status', s.status,
      'coach_pct', COALESCE(c.commission_percent, cm.percent, _cfg.default_coach_commission_pct),
      'hyperrevamp_pct', _cfg.hyperrevamp_pct,
      'gst_pct', _cfg.gst_pct
    )                                                       AS meta
  FROM public.subscriptions s
  LEFT JOIN LATERAL (
    SELECT ca.coach_id
    FROM public.coach_assignments ca
    WHERE ca.user_id = s.user_id
    ORDER BY ca.created_at DESC
    LIMIT 1
  ) a ON true
  LEFT JOIN public.coaches c ON c.id = a.coach_id
  LEFT JOIN public.commission_models cm ON cm.id = c.commission_model_id
  WHERE s.created_at >= _from AND s.created_at < _to
    AND COALESCE(s.status, 'active') <> 'cancelled'

  UNION ALL

  -- YOGA BOOKINGS
  SELECT
    'yoga'::text                                            AS source,
    y.id                                                    AS ref_id,
    y.created_at                                            AS occurred_at,
    y.user_id                                               AS user_id,
    COALESCE(cpp.name, 'Yoga Package')::text                AS label,
    COALESCE(y.price_inr, 0)::numeric                       AS gross,
    ROUND(COALESCE(y.price_inr,0)::numeric
          * _cfg.gst_pct / (100 + _cfg.gst_pct), 2)         AS gst,
    ROUND(COALESCE(y.price_inr,0)::numeric
          * 100.0 / (100 + _cfg.gst_pct), 2)                AS net,
    0::numeric                                              AS coach_cost,
    ROUND(
      (COALESCE(y.price_inr,0)::numeric * 100.0 / (100 + _cfg.gst_pct))
      * COALESCE(cpp.partner_split_pct, _cfg.default_partner_split_pct) / 100.0
    , 2)                                                    AS partner_cost,
    0::numeric                                              AS hyperrevamp_cost,
    ROUND(
      (COALESCE(y.price_inr,0)::numeric * 100.0 / (100 + _cfg.gst_pct))
      - ((COALESCE(y.price_inr,0)::numeric * 100.0 / (100 + _cfg.gst_pct))
          * COALESCE(cpp.partner_split_pct, _cfg.default_partner_split_pct) / 100.0)
    , 2)                                                    AS margin,
    jsonb_build_object(
      'partner_id', y.partner_id,
      'package_id', y.package_id,
      'partner_pct', COALESCE(cpp.partner_split_pct, _cfg.default_partner_split_pct),
      'gst_pct', _cfg.gst_pct,
      'payment_status', y.payment_status
    )                                                       AS meta
  FROM public.yoga_bookings y
  LEFT JOIN public.channel_partner_packages cpp ON cpp.id = y.package_id
  WHERE y.created_at >= _from AND y.created_at < _to
    AND COALESCE(y.payment_status, 'paid') IN ('paid','completed','success')

  ORDER BY occurred_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pnl_compute(timestamptz, timestamptz) TO authenticated;

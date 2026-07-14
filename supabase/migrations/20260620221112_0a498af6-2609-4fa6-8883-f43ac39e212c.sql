
-- 1. Seed the configurable reward window
INSERT INTO public.app_settings (key, value)
VALUES ('referral_reward_days', to_jsonb(30))
ON CONFLICT (key) DO NOTHING;

-- 2. Helper: read reward days
CREATE OR REPLACE FUNCTION public.get_referral_reward_days()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(NULLIF((value)::text, '')::numeric::integer, 30)
  FROM public.app_settings WHERE key = 'referral_reward_days' LIMIT 1;
$$;

-- 3. RPC called by Auth flow when a new user signs up with ?ref=CODE
CREATE OR REPLACE FUNCTION public.apply_referral_code(_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _referrer uuid;
  _me uuid := auth.uid();
  _id uuid;
BEGIN
  IF _me IS NULL OR _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT user_id INTO _referrer
  FROM public.referral_codes
  WHERE code = upper(trim(_code))
  LIMIT 1;

  IF _referrer IS NULL OR _referrer = _me THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_user_id, referral_code, status)
  VALUES (_referrer, _me, upper(trim(_code)), 'pending')
  ON CONFLICT (referred_user_id) DO NOTHING
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- 4. When the referred user's subscription becomes active, grant the reward
CREATE OR REPLACE FUNCTION public.grant_referral_reward_on_subscription()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _ref RECORD;
  _days integer;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  SELECT * INTO _ref FROM public.referrals
  WHERE referred_user_id = NEW.user_id AND reward_granted = false
  LIMIT 1;
  IF _ref IS NULL THEN RETURN NEW; END IF;

  _days := public.get_referral_reward_days();

  UPDATE public.subscriptions
  SET expires_at = GREATEST(expires_at, now()) + make_interval(days => _days)
  WHERE user_id = _ref.referrer_id
    AND status = 'active'
    AND expires_at > now();

  UPDATE public.referrals
  SET status = 'joined', reward_granted = true
  WHERE id = _ref.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_reward ON public.subscriptions;
CREATE TRIGGER trg_referral_reward
AFTER INSERT OR UPDATE OF status ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.grant_referral_reward_on_subscription();

-- 5. Admin overview: join referrer + referred profile names
CREATE OR REPLACE VIEW public.admin_referrals_overview AS
SELECT
  r.id,
  r.created_at,
  r.status,
  r.reward_granted,
  r.referral_code,
  r.referrer_id,
  rp.name AS referrer_name,
  rp.phone AS referrer_phone,
  r.referred_user_id,
  dp.name AS referred_name,
  dp.phone AS referred_phone,
  EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = r.referred_user_id AND s.status = 'active' AND s.expires_at > now()
  ) AS referred_subscribed
FROM public.referrals r
LEFT JOIN public.profiles rp ON rp.user_id = r.referrer_id
LEFT JOIN public.profiles dp ON dp.user_id = r.referred_user_id;

GRANT SELECT ON public.admin_referrals_overview TO authenticated;

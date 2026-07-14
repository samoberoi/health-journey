CREATE OR REPLACE FUNCTION public.complete_demo_payment(
  _plan_id text,
  _plan_name text,
  _plan_price integer,
  _duration_months integer
)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _now timestamptz := now();
  _expires_at timestamptz;
  _subscription public.subscriptions;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to complete payment';
  END IF;

  IF _plan_id IS NULL OR length(trim(_plan_id)) = 0 THEN
    RAISE EXCEPTION 'A package must be selected before payment';
  END IF;

  IF _plan_name IS NULL OR length(trim(_plan_name)) = 0 THEN
    RAISE EXCEPTION 'Package name is required';
  END IF;

  IF _plan_price IS NULL OR _plan_price < 0 THEN
    RAISE EXCEPTION 'Package price is invalid';
  END IF;

  IF _duration_months IS NULL OR _duration_months < 1 THEN
    RAISE EXCEPTION 'Package duration is invalid';
  END IF;

  _expires_at := _now + make_interval(months => _duration_months);

  UPDATE public.subscriptions
  SET status = 'cancelled'
  WHERE user_id = _uid
    AND status = 'active';

  INSERT INTO public.subscriptions (
    user_id,
    plan_id,
    plan_name,
    plan_price,
    duration_months,
    started_at,
    expires_at,
    status
  ) VALUES (
    _uid,
    trim(_plan_id),
    trim(_plan_name),
    _plan_price,
    _duration_months,
    _now,
    _expires_at,
    'active'
  )
  RETURNING * INTO _subscription;

  RETURN _subscription;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_demo_payment(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_demo_payment(text, text, integer, integer) TO authenticated;
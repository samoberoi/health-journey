CREATE OR REPLACE FUNCTION public.book_yoga_month(
  _partner_id uuid,
  _package_id uuid,
  _package_type text,
  _price_inr integer,
  _template_id uuid,
  _selected_slot text,
  _duration_days integer DEFAULT 30
) RETURNS public.yoga_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _now timestamptz := now();
  _starts date := (_now AT TIME ZONE 'UTC')::date;
  _expires date := _starts + make_interval(days => COALESCE(_duration_days, 30));
  _first_slot_id uuid;
  _booking public.yoga_bookings;
  _slot_count integer := 0;
  _updated_count integer := 0;
  _min_remaining integer := 0;
  _template public.channel_partner_slot_templates%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to book' USING ERRCODE = '42501';
  END IF;

  IF _template_id IS NULL THEN
    RAISE EXCEPTION 'A recurring slot must be selected' USING ERRCODE = '22004';
  END IF;

  SELECT * INTO _template
  FROM public.channel_partner_slot_templates
  WHERE id = _template_id
    AND partner_id = _partner_id
    AND package_id = _package_id
    AND package_type = _package_type
    AND is_active = true;

  IF _template.id IS NULL THEN
    RAISE EXCEPTION 'Selected recurring slot was not found' USING ERRCODE = '23503';
  END IF;

  WITH locked AS (
    SELECT id, capacity, booked_count, scheduled_at
    FROM public.channel_partner_slots
    WHERE template_id = _template_id
      AND partner_id = _partner_id
      AND package_id = _package_id
      AND package_type = _package_type
      AND is_active = true
      AND scheduled_at >= _now
      AND scheduled_at::date <= _expires
    ORDER BY scheduled_at ASC
    FOR UPDATE
  )
  SELECT
    COUNT(*)::integer,
    COALESCE(MIN(capacity - booked_count), 0)::integer,
    (ARRAY_AGG(id ORDER BY scheduled_at))[1]
  INTO _slot_count, _min_remaining, _first_slot_id
  FROM locked;

  IF _slot_count = 0 OR _first_slot_id IS NULL THEN
    RAISE EXCEPTION 'No upcoming classes are available for this recurring slot' USING ERRCODE = '23514';
  END IF;

  IF _min_remaining <= 0 THEN
    RAISE EXCEPTION 'This recurring slot is already fully booked' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.yoga_bookings (
    user_id, partner_id, package_id, package_type, price_inr,
    selected_slot, slot_id, template_id,
    preferred_time, preferred_days, notes,
    status, payment_status, payment_ref, starts_on, expires_on
  ) VALUES (
    _uid, _partner_id, _package_id, _package_type, _price_inr,
    _selected_slot, NULL, _template_id,
    NULL, ARRAY[]::text[], NULL,
    'scheduled', 'paid', 'DEMO-' || extract(epoch from _now)::bigint, _starts, _expires
  )
  RETURNING * INTO _booking;

  WITH upd AS (
    UPDATE public.channel_partner_slots s
    SET booked_count = booked_count + 1,
        updated_at = now()
    WHERE s.template_id = _template_id
      AND s.partner_id = _partner_id
      AND s.package_id = _package_id
      AND s.package_type = _package_type
      AND s.is_active = true
      AND s.scheduled_at >= _now
      AND s.scheduled_at::date <= _expires
      AND s.booked_count < s.capacity
    RETURNING 1
  )
  SELECT COUNT(*)::integer INTO _updated_count FROM upd;

  IF _updated_count <> _slot_count THEN
    RAISE EXCEPTION 'Recurring slot availability changed. Please choose another slot.' USING ERRCODE = '40001';
  END IF;

  RETURN _booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_yoga_month(uuid, uuid, text, integer, uuid, text, integer) TO authenticated;

UPDATE public.channel_partner_slots s
SET booked_count = LEAST(
  s.capacity,
  COALESCE((
    SELECT COUNT(*)::integer
    FROM public.yoga_bookings yb
    WHERE yb.status NOT IN ('cancelled', 'completed')
      AND (
        (yb.template_id = s.template_id
          AND s.scheduled_at::date >= COALESCE(yb.starts_on, s.scheduled_at::date)
          AND s.scheduled_at::date <= COALESCE(yb.expires_on, s.scheduled_at::date))
        OR yb.slot_id = s.id
      )
  ), 0)
),
updated_at = now()
WHERE s.template_id IS NOT NULL;
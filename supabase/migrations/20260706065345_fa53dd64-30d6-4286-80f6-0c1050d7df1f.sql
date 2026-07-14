
ALTER TABLE public.yoga_bookings ADD COLUMN IF NOT EXISTS template_id uuid;
CREATE INDEX IF NOT EXISTS idx_yoga_bookings_template ON public.yoga_bookings (template_id);

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
  _reserved integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to book' USING ERRCODE = '42501';
  END IF;
  IF _template_id IS NULL THEN
    RAISE EXCEPTION 'A recurring slot must be selected' USING ERRCODE = '22004';
  END IF;

  -- First upcoming instance for this template (used as the anchor slot_id)
  SELECT id INTO _first_slot_id
  FROM public.channel_partner_slots
  WHERE template_id = _template_id
    AND is_active = true
    AND scheduled_at >= _now
    AND booked_count < capacity
  ORDER BY scheduled_at ASC
  LIMIT 1;

  INSERT INTO public.yoga_bookings (
    user_id, partner_id, package_id, package_type, price_inr,
    selected_slot, slot_id, template_id,
    preferred_time, preferred_days, notes,
    status, payment_status, payment_ref, starts_on, expires_on
  ) VALUES (
    _uid, _partner_id, _package_id, _package_type, _price_inr,
    _selected_slot, _first_slot_id, _template_id,
    NULL, ARRAY[]::text[], NULL,
    'scheduled', 'paid', 'DEMO-' || extract(epoch from _now)::bigint, _starts, _expires
  )
  RETURNING * INTO _booking;

  -- Reserve every remaining upcoming instance in the validity window.
  -- The first instance was already incremented by the slot-sync trigger via slot_id.
  WITH upd AS (
    UPDATE public.channel_partner_slots s
    SET booked_count = booked_count + 1,
        updated_at = now()
    WHERE s.template_id = _template_id
      AND s.is_active = true
      AND s.scheduled_at >= _now
      AND s.scheduled_at::date <= _expires
      AND s.booked_count < s.capacity
      AND s.id <> COALESCE(_first_slot_id, '00000000-0000-0000-0000-000000000000'::uuid)
    RETURNING 1
  )
  SELECT count(*) INTO _reserved FROM upd;

  RETURN _booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_yoga_month(uuid, uuid, text, integer, uuid, text, integer) TO authenticated;

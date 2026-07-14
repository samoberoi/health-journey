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
  _starts date := (_now AT TIME ZONE 'Asia/Kolkata')::date;
  _expires date := _starts + make_interval(days => COALESCE(_duration_days, 30));
  _booking public.yoga_bookings;
  _slot_count integer := 0;
  _min_remaining integer := 0;
  _target_count integer := 8;
  _template public.channel_partner_slot_templates%ROWTYPE;
  _d date;
  _at timestamptz;
  _h integer;
  _m integer;
  _selected_slot_ids uuid[] := ARRAY[]::uuid[];
  _last_slot_at timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to book' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(classes_per_month, 8) INTO _target_count
  FROM public.channel_partner_packages
  WHERE id = _package_id
    AND partner_id = _partner_id
    AND package_type = _package_type
    AND is_active = true;

  IF _target_count IS NULL OR _target_count < 1 THEN
    _target_count := 8;
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

  _h := EXTRACT(HOUR FROM _template.time_of_day)::integer;
  _m := EXTRACT(MINUTE FROM _template.time_of_day)::integer;
  _d := _starts;

  WHILE _d <= (_starts + interval '90 days')::date LOOP
    IF EXTRACT(DOW FROM _d)::integer = ANY(_template.days_of_week) THEN
      _at := make_timestamptz(EXTRACT(YEAR FROM _d)::integer, EXTRACT(MONTH FROM _d)::integer, EXTRACT(DAY FROM _d)::integer, _h, _m, 0, 'Asia/Kolkata');
      IF _at >= _now AND NOT EXISTS (
        SELECT 1 FROM public.channel_partner_slots s
        WHERE s.template_id = _template.id
          AND s.scheduled_at = _at
      ) THEN
        INSERT INTO public.channel_partner_slots (
          partner_id, package_id, package_type, title, scheduled_at, duration_min,
          meet_link, capacity, notes, is_active, template_id, template_label
        ) VALUES (
          _template.partner_id, _template.package_id, _template.package_type, _template.label,
          _at, _template.duration_min, _template.meet_link,
          CASE WHEN _template.package_type = 'private' THEN 1 ELSE _template.capacity END,
          _template.notes, _template.is_active, _template.id, _template.label
        );
      END IF;
    END IF;

    SELECT ARRAY_AGG(id ORDER BY scheduled_at), COUNT(*)::integer
    INTO _selected_slot_ids, _slot_count
    FROM (
      SELECT id, scheduled_at
      FROM public.channel_partner_slots
      WHERE template_id = _template_id
        AND partner_id = _partner_id
        AND package_id = _package_id
        AND package_type = _package_type
        AND is_active = true
        AND scheduled_at >= _now
      ORDER BY scheduled_at ASC
      LIMIT _target_count
    ) s;

    EXIT WHEN COALESCE(_slot_count, 0) >= _target_count;
    _d := _d + 1;
  END LOOP;

  IF COALESCE(array_length(_selected_slot_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'No upcoming classes are available for this recurring slot' USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*)::integer, COALESCE(MIN(capacity - booked_count), 0)::integer, MAX(scheduled_at)
  INTO _slot_count, _min_remaining, _last_slot_at
  FROM public.channel_partner_slots
  WHERE id = ANY(_selected_slot_ids)
  FOR UPDATE;

  IF _slot_count < _target_count THEN
    RAISE EXCEPTION 'This recurring slot does not have enough upcoming classes yet' USING ERRCODE = '23514';
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
    'scheduled', 'paid', 'DEMO-' || extract(epoch from _now)::bigint, _starts,
    GREATEST(_expires, COALESCE(_last_slot_at::date, _expires))
  )
  RETURNING * INTO _booking;

  INSERT INTO public.yoga_booking_instances (booking_id, user_id, partner_id, package_id, template_id, slot_id)
  SELECT _booking.id, _uid, _partner_id, _package_id, _template_id, unnest(_selected_slot_ids);

  PERFORM public.recompute_yoga_template_slot_counts(_template_id);

  RETURN _booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_yoga_month(uuid, uuid, text, integer, uuid, text, integer) TO authenticated;

WITH bad_slots AS (
  SELECT s.id, s.template_id
  FROM public.channel_partner_slots s
  JOIN public.channel_partner_slot_templates t ON t.id = s.template_id
  WHERE s.scheduled_at::time = t.time_of_day
    AND t.package_type = 'private'
    AND s.created_at > now() - interval '1 hour'
)
DELETE FROM public.channel_partner_slots s
USING bad_slots b
WHERE s.id = b.id;

DO $$
DECLARE
  b record;
  tmpl public.channel_partner_slot_templates%ROWTYPE;
  target_count integer;
  have_count integer;
  d date;
  at_time timestamptz;
  h integer;
  m integer;
  slot_ids uuid[];
BEGIN
  FOR b IN
    SELECT yb.*
    FROM public.yoga_bookings yb
    WHERE yb.template_id IS NOT NULL
      AND yb.status NOT IN ('cancelled', 'completed')
  LOOP
    SELECT COALESCE(classes_per_month, 8) INTO target_count
    FROM public.channel_partner_packages
    WHERE id = b.package_id;
    IF target_count IS NULL OR target_count < 1 THEN target_count := 8; END IF;

    SELECT * INTO tmpl FROM public.channel_partner_slot_templates WHERE id = b.template_id;
    IF tmpl.id IS NULL THEN CONTINUE; END IF;

    h := EXTRACT(HOUR FROM tmpl.time_of_day)::integer;
    m := EXTRACT(MINUTE FROM tmpl.time_of_day)::integer;
    d := (b.created_at AT TIME ZONE 'Asia/Kolkata')::date;

    LOOP
      SELECT COUNT(*)::integer INTO have_count
      FROM public.channel_partner_slots s
      WHERE s.template_id = b.template_id
        AND s.is_active = true
        AND s.scheduled_at >= b.created_at;

      EXIT WHEN have_count >= target_count OR d > ((b.created_at AT TIME ZONE 'Asia/Kolkata')::date + interval '90 days')::date;

      IF EXTRACT(DOW FROM d)::integer = ANY(tmpl.days_of_week) THEN
        at_time := make_timestamptz(EXTRACT(YEAR FROM d)::integer, EXTRACT(MONTH FROM d)::integer, EXTRACT(DAY FROM d)::integer, h, m, 0, 'Asia/Kolkata');
        IF at_time >= b.created_at AND NOT EXISTS (
          SELECT 1 FROM public.channel_partner_slots s
          WHERE s.template_id = tmpl.id
            AND s.scheduled_at = at_time
        ) THEN
          INSERT INTO public.channel_partner_slots (
            partner_id, package_id, package_type, title, scheduled_at, duration_min,
            meet_link, capacity, notes, is_active, template_id, template_label
          ) VALUES (
            tmpl.partner_id, tmpl.package_id, tmpl.package_type, tmpl.label,
            at_time, tmpl.duration_min, tmpl.meet_link,
            CASE WHEN tmpl.package_type = 'private' THEN 1 ELSE tmpl.capacity END,
            tmpl.notes, tmpl.is_active, tmpl.id, tmpl.label
          );
        END IF;
      END IF;
      d := d + 1;
    END LOOP;

    SELECT ARRAY_AGG(id ORDER BY scheduled_at)
    INTO slot_ids
    FROM (
      SELECT s.id, s.scheduled_at
      FROM public.channel_partner_slots s
      WHERE s.template_id = b.template_id
        AND s.is_active = true
        AND s.scheduled_at >= b.created_at
      ORDER BY s.scheduled_at ASC
      LIMIT target_count
    ) chosen;

    DELETE FROM public.yoga_booking_instances WHERE booking_id = b.id;

    IF COALESCE(array_length(slot_ids, 1), 0) > 0 THEN
      INSERT INTO public.yoga_booking_instances (booking_id, user_id, partner_id, package_id, template_id, slot_id)
      SELECT b.id, b.user_id, b.partner_id, b.package_id, b.template_id, unnest(slot_ids)
      ON CONFLICT (booking_id, slot_id) DO NOTHING;

      UPDATE public.yoga_bookings
      SET expires_on = GREATEST(
            COALESCE(expires_on, current_date),
            COALESCE((SELECT max(scheduled_at)::date FROM public.channel_partner_slots WHERE id = ANY(slot_ids)), COALESCE(expires_on, current_date))
          ),
          updated_at = now()
      WHERE id = b.id;
    END IF;

    PERFORM public.recompute_yoga_template_slot_counts(b.template_id);
  END LOOP;
END $$;
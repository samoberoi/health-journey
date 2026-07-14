CREATE TABLE IF NOT EXISTS public.yoga_booking_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.yoga_bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  partner_id uuid NOT NULL REFERENCES public.channel_partners(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.channel_partner_packages(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.channel_partner_slot_templates(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES public.channel_partner_slots(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, slot_id)
);

GRANT SELECT ON public.yoga_booking_instances TO authenticated;
GRANT ALL ON public.yoga_booking_instances TO service_role;

ALTER TABLE public.yoga_booking_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users and partners can view yoga booking classes"
ON public.yoga_booking_instances
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.channel_partners cp
    WHERE cp.id = yoga_booking_instances.partner_id
      AND cp.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_yoga_booking_instances_booking ON public.yoga_booking_instances(booking_id);
CREATE INDEX IF NOT EXISTS idx_yoga_booking_instances_slot ON public.yoga_booking_instances(slot_id);
CREATE INDEX IF NOT EXISTS idx_yoga_booking_instances_template ON public.yoga_booking_instances(template_id);

CREATE OR REPLACE FUNCTION public.recompute_yoga_template_slot_counts(_template_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.channel_partner_slots s
  SET booked_count = LEAST(
    s.capacity,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.yoga_booking_instances ybi
      JOIN public.yoga_bookings yb ON yb.id = ybi.booking_id
      WHERE ybi.slot_id = s.id
        AND ybi.status = 'reserved'
        AND yb.status NOT IN ('cancelled', 'completed')
    ), 0)
  ),
  updated_at = now()
  WHERE s.template_id = _template_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_yoga_template_booking_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _template_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'yoga_booking_instances' THEN
    _template_id := COALESCE(NEW.template_id, OLD.template_id);
    IF _template_id IS NOT NULL THEN
      PERFORM public.recompute_yoga_template_slot_counts(_template_id);
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    FOR _template_id IN
      SELECT DISTINCT template_id FROM public.yoga_booking_instances WHERE booking_id = OLD.id
      UNION
      SELECT OLD.template_id WHERE OLD.template_id IS NOT NULL
    LOOP
      PERFORM public.recompute_yoga_template_slot_counts(_template_id);
    END LOOP;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    FOR _template_id IN
      SELECT DISTINCT template_id FROM public.yoga_booking_instances WHERE booking_id = NEW.id
      UNION
      SELECT NEW.template_id WHERE NEW.template_id IS NOT NULL
    LOOP
      PERFORM public.recompute_yoga_template_slot_counts(_template_id);
    END LOOP;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_yoga_booking_instance_counts_trigger ON public.yoga_booking_instances;
CREATE TRIGGER sync_yoga_booking_instance_counts_trigger
AFTER INSERT OR UPDATE OF slot_id, status OR DELETE
ON public.yoga_booking_instances
FOR EACH ROW
EXECUTE FUNCTION public.sync_yoga_template_booking_counts();

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
  WHILE _d <= (_starts + interval '60 days')::date LOOP
    IF EXTRACT(DOW FROM _d)::integer = ANY(_template.days_of_week) THEN
      _at := (_d::timestamp + make_interval(hours => _h, mins => _m)) AT TIME ZONE current_setting('TIMEZONE');
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
GRANT EXECUTE ON FUNCTION public.recompute_yoga_template_slot_counts(uuid) TO authenticated;

WITH legacy AS (
  SELECT yb.*, COALESCE(pkg.classes_per_month, 8) AS target_count
  FROM public.yoga_bookings yb
  JOIN public.channel_partner_packages pkg ON pkg.id = yb.package_id
  WHERE yb.template_id IS NOT NULL
    AND yb.status NOT IN ('cancelled', 'completed')
    AND NOT EXISTS (
      SELECT 1 FROM public.yoga_booking_instances ybi WHERE ybi.booking_id = yb.id
    )
), chosen AS (
  SELECT l.id AS booking_id, l.user_id, l.partner_id, l.package_id, l.template_id, s.id AS slot_id,
         row_number() OVER (PARTITION BY l.id ORDER BY s.scheduled_at ASC) AS rn,
         l.target_count
  FROM legacy l
  JOIN public.channel_partner_slots s ON s.template_id = l.template_id
  WHERE s.is_active = true
    AND s.scheduled_at >= now()
)
INSERT INTO public.yoga_booking_instances (booking_id, user_id, partner_id, package_id, template_id, slot_id)
SELECT booking_id, user_id, partner_id, package_id, template_id, slot_id
FROM chosen
WHERE rn <= target_count
ON CONFLICT (booking_id, slot_id) DO NOTHING;

SELECT public.recompute_yoga_template_slot_counts(id)
FROM public.channel_partner_slot_templates;
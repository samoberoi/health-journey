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
    d := COALESCE(b.starts_on, current_date);

    LOOP
      SELECT COUNT(*)::integer INTO have_count
      FROM public.channel_partner_slots s
      WHERE s.template_id = b.template_id
        AND s.is_active = true
        AND s.scheduled_at >= b.created_at;

      EXIT WHEN have_count >= target_count OR d > (COALESCE(b.starts_on, current_date) + interval '90 days')::date;

      IF EXTRACT(DOW FROM d)::integer = ANY(tmpl.days_of_week) THEN
        at_time := (d::timestamp + make_interval(hours => h, mins => m)) AT TIME ZONE current_setting('TIMEZONE');
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
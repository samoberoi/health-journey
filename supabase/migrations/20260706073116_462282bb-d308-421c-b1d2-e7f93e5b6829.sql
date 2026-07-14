
-- Partner approves a custom-slot request with confirmed time/days.
CREATE OR REPLACE FUNCTION public.approve_custom_slot_request(
  _booking_id uuid,
  _time_of_day text,      -- 'HH:MM'
  _days_of_week int[],    -- 0=Sun..6=Sat
  _duration_min int DEFAULT 60,
  _meet_link text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _b public.yoga_bookings%ROWTYPE;
  _partner_user uuid;
BEGIN
  SELECT * INTO _b FROM public.yoga_bookings WHERE id = _booking_id;
  IF _b.id IS NULL THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF _b.status NOT IN ('custom_slot_requested','pending_schedule') THEN
    RAISE EXCEPTION 'Booking is not awaiting approval';
  END IF;

  SELECT user_id INTO _partner_user FROM public.channel_partners WHERE id = _b.partner_id;
  IF _partner_user <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.yoga_bookings
  SET status = 'awaiting_payment',
      payment_status = 'pending',
      preferred_time = _time_of_day,
      preferred_days = ARRAY(SELECT x::text FROM unnest(_days_of_week) x),
      notes = COALESCE(notes,'') ||
              CASE WHEN _meet_link IS NOT NULL AND length(trim(_meet_link))>0
                   THEN E'\nMeet: '||_meet_link ELSE '' END
  WHERE id = _booking_id;

  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (
    _b.user_id,
    'Custom slot approved — complete payment',
    'Your instructor approved ' || _time_of_day || ' on days ' || array_to_string(_days_of_week, ', ') ||
    '. Pay now to lock your monthly series.',
    'custom_slot_approved', '✅', '/dashboard?tab=yoga'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_custom_slot_request(uuid,text,int[],int,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_custom_slot_request(uuid,text,int[],int,text) TO authenticated;

-- User pays for approved custom slot. Creates a private slot template, generates
-- classes, cancels the placeholder booking, and books the series via book_yoga_month.
CREATE OR REPLACE FUNCTION public.pay_and_create_custom_slot(_booking_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _b public.yoga_bookings%ROWTYPE;
  _time time;
  _days int[];
  _template_id uuid;
  _label text;
  _slot_count int;
  _new_booking public.yoga_bookings;
  _partner_user uuid;
  _classes_per_month int;
BEGIN
  SELECT * INTO _b FROM public.yoga_bookings WHERE id = _booking_id;
  IF _b.id IS NULL THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF _b.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF _b.status <> 'awaiting_payment' THEN
    RAISE EXCEPTION 'Booking is not awaiting payment';
  END IF;

  -- Parse preferred_time 'HH:MM' → time
  BEGIN
    _time := (_b.preferred_time || ':00')::time;
  EXCEPTION WHEN OTHERS THEN
    _time := '07:00:00'::time;
  END;

  -- Parse preferred_days (stored as text[] of integers 0..6)
  SELECT COALESCE(array_agg(x::int), ARRAY[1,3,5])
    INTO _days
    FROM unnest(COALESCE(_b.preferred_days, ARRAY[]::text[])) x
   WHERE x ~ '^[0-6]$';
  IF _days IS NULL OR array_length(_days,1) IS NULL THEN
    _days := ARRAY[1,3,5];
  END IF;

  -- Count next slot number for label
  SELECT COUNT(*)+1 INTO _slot_count
    FROM public.channel_partner_slot_templates
   WHERE partner_id = _b.partner_id AND package_id = _b.package_id;
  _label := 'Custom Slot ' || _slot_count;

  -- Create the private template
  INSERT INTO public.channel_partner_slot_templates (
    partner_id, package_id, package_type, label, time_of_day, duration_min,
    days_of_week, start_date, weeks_count, meet_link, capacity, notes, is_active
  ) VALUES (
    _b.partner_id, _b.package_id, 'private', _label, _time, 60,
    _days, (now() AT TIME ZONE 'Asia/Kolkata')::date, 4, NULL, 1,
    'Auto-created from approved custom request', true
  ) RETURNING id INTO _template_id;

  SELECT COALESCE(classes_per_month, 8) INTO _classes_per_month
    FROM public.channel_partner_packages WHERE id = _b.package_id;

  -- Cancel the placeholder booking so counts stay right
  UPDATE public.yoga_bookings
     SET status = 'cancelled',
         notes = COALESCE(notes,'') || E'\n[replaced by paid series]'
   WHERE id = _booking_id;

  -- Book the full series via existing RPC (creates instances, updates counts)
  SELECT * INTO _new_booking FROM public.book_yoga_month(
    _b.partner_id, _b.package_id, _b.package_type, _b.price_inr,
    _template_id, _label, 30
  );

  -- Notify the partner
  SELECT user_id INTO _partner_user FROM public.channel_partners WHERE id = _b.partner_id;
  IF _partner_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
    VALUES (
      _partner_user,
      'Custom slot paid & booked',
      'Your subscriber paid and their ' || _label || ' series is now live.',
      'custom_slot_paid', '💸', '/partner?tab=subscribers'
    );
  END IF;

  RETURN _new_booking.id;
END;
$$;

REVOKE ALL ON FUNCTION public.pay_and_create_custom_slot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_and_create_custom_slot(uuid) TO authenticated;

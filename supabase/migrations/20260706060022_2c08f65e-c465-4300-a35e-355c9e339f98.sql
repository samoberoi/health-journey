CREATE OR REPLACE FUNCTION public.sync_yoga_booking_slot_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _slot public.channel_partner_slots%ROWTYPE;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.slot_id IS NOT NULL THEN
    UPDATE public.channel_partner_slots
    SET booked_count = GREATEST(booked_count - 1, 0),
        updated_at = now()
    WHERE id = OLD.slot_id
      AND (TG_OP = 'DELETE' OR OLD.slot_id IS DISTINCT FROM NEW.slot_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.slot_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.slot_id IS DISTINCT FROM NEW.slot_id) THEN
    SELECT * INTO _slot
    FROM public.channel_partner_slots
    WHERE id = NEW.slot_id
    FOR UPDATE;

    IF _slot.id IS NULL THEN
      RAISE EXCEPTION 'Selected class slot was not found' USING ERRCODE = '23503';
    END IF;

    IF _slot.is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'Selected class slot is not active' USING ERRCODE = '23514';
    END IF;

    IF _slot.scheduled_at < now() THEN
      RAISE EXCEPTION 'Selected class slot has already started' USING ERRCODE = '23514';
    END IF;

    IF _slot.partner_id <> NEW.partner_id
       OR COALESCE(_slot.package_id, NEW.package_id) <> NEW.package_id
       OR _slot.package_type <> NEW.package_type THEN
      RAISE EXCEPTION 'Selected class slot does not match this package' USING ERRCODE = '23514';
    END IF;

    IF _slot.booked_count >= _slot.capacity THEN
      RAISE EXCEPTION 'Selected class slot is full' USING ERRCODE = '23514';
    END IF;

    UPDATE public.channel_partner_slots
    SET booked_count = booked_count + 1,
        updated_at = now()
    WHERE id = NEW.slot_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_yoga_booking_slot_count_trigger ON public.yoga_bookings;
CREATE TRIGGER sync_yoga_booking_slot_count_trigger
BEFORE INSERT OR UPDATE OF slot_id, partner_id, package_id, package_type OR DELETE
ON public.yoga_bookings
FOR EACH ROW
EXECUTE FUNCTION public.sync_yoga_booking_slot_count();
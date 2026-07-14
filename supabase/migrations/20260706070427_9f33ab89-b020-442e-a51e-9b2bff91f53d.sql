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
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    _template_id := OLD.template_id;
    IF _template_id IS NULL AND OLD.slot_id IS NOT NULL THEN
      SELECT template_id INTO _template_id FROM public.channel_partner_slots WHERE id = OLD.slot_id;
    END IF;
    IF _template_id IS NOT NULL THEN
      PERFORM public.recompute_yoga_template_slot_counts(_template_id);
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    _template_id := NEW.template_id;
    IF _template_id IS NULL AND NEW.slot_id IS NOT NULL THEN
      SELECT template_id INTO _template_id FROM public.channel_partner_slots WHERE id = NEW.slot_id;
    END IF;
    IF _template_id IS NOT NULL THEN
      PERFORM public.recompute_yoga_template_slot_counts(_template_id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_yoga_template_booking_counts_trigger ON public.yoga_bookings;
CREATE TRIGGER sync_yoga_template_booking_counts_trigger
AFTER INSERT OR UPDATE OF template_id, slot_id, status, starts_on, expires_on OR DELETE
ON public.yoga_bookings
FOR EACH ROW
EXECUTE FUNCTION public.sync_yoga_template_booking_counts();

GRANT EXECUTE ON FUNCTION public.recompute_yoga_template_slot_counts(uuid) TO authenticated;

SELECT public.recompute_yoga_template_slot_counts(id)
FROM public.channel_partner_slot_templates;
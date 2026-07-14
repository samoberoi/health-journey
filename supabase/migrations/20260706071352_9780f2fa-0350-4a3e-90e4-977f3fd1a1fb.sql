REVOKE ALL ON FUNCTION public.book_yoga_month(uuid, uuid, text, integer, uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.book_yoga_month(uuid, uuid, text, integer, uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.book_yoga_month(uuid, uuid, text, integer, uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.recompute_yoga_template_slot_counts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_yoga_template_slot_counts(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recompute_yoga_template_slot_counts(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_yoga_template_booking_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_yoga_template_booking_counts() FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_yoga_template_booking_counts() TO authenticated;
REVOKE ALL ON FUNCTION public.recompute_movement_progress_for_user(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_movement_progress_for_user(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.recompute_movement_progress_for_user(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_movement_progress_for_user(uuid, date) TO service_role;
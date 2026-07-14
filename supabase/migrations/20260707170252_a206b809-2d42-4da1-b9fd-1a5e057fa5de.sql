REVOKE EXECUTE ON FUNCTION public.compute_global_streak_for_user(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.compute_global_streak_for_user(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.compute_global_streak_for_user(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_global_streak_for_user(uuid, date) TO service_role;
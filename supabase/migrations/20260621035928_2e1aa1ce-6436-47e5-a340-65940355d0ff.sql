REVOKE ALL ON FUNCTION public.notify_community_comment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_community_like() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_community_comment() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_community_like() TO service_role;
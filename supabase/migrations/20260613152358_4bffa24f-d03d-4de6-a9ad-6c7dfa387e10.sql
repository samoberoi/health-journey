REVOKE EXECUTE ON FUNCTION public.bulk_disable_lab_tests(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bulk_disable_lab_tests(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.bulk_disable_lab_tests(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_disable_lab_tests(uuid[]) TO service_role;
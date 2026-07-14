REVOKE EXECUTE ON FUNCTION public.complete_demo_payment(text, text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_demo_payment(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_demo_payment(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_demo_payment(text, text, integer, integer) TO service_role;
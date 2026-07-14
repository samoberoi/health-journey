
REVOKE EXECUTE ON FUNCTION public.rename_supplement_category(text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_supplement_category(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rename_supplement_condition(text, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_supplement_condition(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.rename_supplement_category(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_supplement_category(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_supplement_condition(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_supplement_condition(text) TO authenticated;

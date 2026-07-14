CREATE OR REPLACE FUNCTION public.lab_tests_in_use(_product_codes text[])
RETURNS TABLE(product_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT pc
  FROM (
    SELECT unnest(product_codes) AS pc FROM public.thyrocare_recommendations
    WHERE product_codes && _product_codes
    UNION ALL
    SELECT unnest(product_codes) AS pc FROM public.thyrocare_orders
    WHERE product_codes && _product_codes
      AND COALESCE(status, '') NOT IN ('cancelled', 'failed')
  ) s
  WHERE pc = ANY(_product_codes);
$$;

REVOKE EXECUTE ON FUNCTION public.lab_tests_in_use(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lab_tests_in_use(text[]) TO authenticated, service_role;
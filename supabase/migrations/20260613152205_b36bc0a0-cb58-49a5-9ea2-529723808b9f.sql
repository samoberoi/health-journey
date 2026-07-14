CREATE OR REPLACE FUNCTION public.bulk_disable_lab_tests(_test_ids uuid[])
RETURNS TABLE(disabled_count integer, protected_count integer, protected_codes text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ids uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can disable lab tests' USING ERRCODE = '42501';
  END IF;

  _ids := COALESCE(_test_ids, ARRAY[]::uuid[]);

  IF array_length(_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0::integer, 0::integer, ARRAY[]::text[];
    RETURN;
  END IF;

  RETURN QUERY
  WITH chosen AS (
    SELECT DISTINCT t.id, t.product_code
    FROM public.thyrocare_tests t
    WHERE t.id = ANY(_ids)
      AND t.is_active = true
  ),
  protected AS (
    SELECT DISTINCT c.id, c.product_code
    FROM chosen c
    WHERE EXISTS (
      SELECT 1
      FROM public.thyrocare_recommendations r
      WHERE c.product_code = ANY(r.product_codes)
    )
    OR EXISTS (
      SELECT 1
      FROM public.thyrocare_orders o
      WHERE c.product_code = ANY(o.product_codes)
        AND COALESCE(o.status, '') NOT IN ('cancelled', 'failed')
    )
  ),
  updated AS (
    UPDATE public.thyrocare_tests t
    SET is_active = false,
        coach_assignable = false,
        updated_at = now()
    WHERE t.id IN (SELECT c.id FROM chosen c)
      AND t.id NOT IN (SELECT p.id FROM protected p)
    RETURNING t.id
  )
  SELECT
    (SELECT COUNT(*)::integer FROM updated),
    (SELECT COUNT(*)::integer FROM protected),
    COALESCE((SELECT array_agg(product_code ORDER BY product_code) FROM protected), ARRAY[]::text[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_disable_lab_tests(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_disable_lab_tests(uuid[]) TO service_role;
CREATE OR REPLACE FUNCTION public.bulk_enable_lab_tests(_test_ids uuid[])
RETURNS TABLE(enabled_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _ids uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can enable lab tests' USING ERRCODE = '42501';
  END IF;

  _ids := COALESCE(_test_ids, ARRAY[]::uuid[]);

  IF array_length(_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0::integer;
    RETURN;
  END IF;

  RETURN QUERY
  WITH chosen AS (
    SELECT DISTINCT t.id
    FROM public.thyrocare_tests t
    WHERE t.id = ANY(_ids)
      AND COALESCE(t.is_active, false) = false
  ),
  updated AS (
    UPDATE public.thyrocare_tests t
    SET is_active = true,
        updated_at = now()
    WHERE t.id IN (SELECT c.id FROM chosen c)
    RETURNING t.id
  )
  SELECT COUNT(*)::integer FROM updated;
END;
$function$;

REVOKE ALL ON FUNCTION public.bulk_enable_lab_tests(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_enable_lab_tests(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.bulk_enable_lab_tests(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_enable_lab_tests(uuid[]) TO service_role;
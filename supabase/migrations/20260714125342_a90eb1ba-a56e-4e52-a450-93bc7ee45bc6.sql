CREATE OR REPLACE FUNCTION public._bootstrap_exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
REVOKE ALL ON FUNCTION public._bootstrap_exec_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._bootstrap_exec_sql(text) TO service_role;
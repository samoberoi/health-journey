DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT CREATE ON SCHEMA public TO postgres, service_role;

-- Drop any storage.objects policies from prior partial runs
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public._bootstrap_exec_sql(sql text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN EXECUTE sql; END; $$;
REVOKE ALL ON FUNCTION public._bootstrap_exec_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._bootstrap_exec_sql(text) TO service_role;
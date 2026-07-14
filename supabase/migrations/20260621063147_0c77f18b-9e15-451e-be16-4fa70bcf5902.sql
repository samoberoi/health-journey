GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_supplement_plans TO authenticated;
GRANT ALL ON public.user_supplement_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_supplement_plan_items TO authenticated;
GRANT ALL ON public.user_supplement_plan_items TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_supplement_plan_items'
      AND policyname = 'Users can insert own supplement plan items'
  ) THEN
    CREATE POLICY "Users can insert own supplement plan items"
    ON public.user_supplement_plan_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.user_supplement_plans p
        WHERE p.id = user_supplement_plan_items.plan_id
          AND p.user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_supplement_plan_items'
      AND policyname = 'Users can update own supplement plan items'
  ) THEN
    CREATE POLICY "Users can update own supplement plan items"
    ON public.user_supplement_plan_items
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.user_supplement_plans p
        WHERE p.id = user_supplement_plan_items.plan_id
          AND p.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.user_supplement_plans p
        WHERE p.id = user_supplement_plan_items.plan_id
          AND p.user_id = auth.uid()
      )
    );
  END IF;
END $$;
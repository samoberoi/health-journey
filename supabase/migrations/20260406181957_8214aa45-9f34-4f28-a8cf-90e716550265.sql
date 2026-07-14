
DROP POLICY "Authenticated can view weekly plans" ON public.fasting_weekly_plans;
CREATE POLICY "Authenticated can view weekly plans for active protocols" ON public.fasting_weekly_plans FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.fasting_protocols fp WHERE fp.id = protocol_id AND fp.is_active = true)
);

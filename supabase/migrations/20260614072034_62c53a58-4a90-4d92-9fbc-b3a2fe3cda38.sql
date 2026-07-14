GRANT SELECT, INSERT, UPDATE ON public.thyrocare_recommendations TO authenticated;
GRANT ALL ON public.thyrocare_recommendations TO service_role;

GRANT SELECT, INSERT ON public.thyrocare_orders TO authenticated;
GRANT ALL ON public.thyrocare_orders TO service_role;

GRANT SELECT ON public.thyrocare_reports TO authenticated;
GRANT ALL ON public.thyrocare_reports TO service_role;

GRANT SELECT ON public.thyrocare_tests TO authenticated;
GRANT ALL ON public.thyrocare_tests TO service_role;
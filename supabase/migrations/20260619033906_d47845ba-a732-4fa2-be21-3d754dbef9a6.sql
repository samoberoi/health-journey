ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS show_in_onboarding boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS assigns_coach boolean NOT NULL DEFAULT true;

UPDATE public.packages
   SET show_in_onboarding = false,
       assigns_coach = false
 WHERE plan_key IN ('foundation', 'starter');
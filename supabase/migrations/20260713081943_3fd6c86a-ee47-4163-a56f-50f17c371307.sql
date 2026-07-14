ALTER TABLE public.fasting_stage_milestones ALTER COLUMN compliant_days_required SET DEFAULT 7;
UPDATE public.fasting_stage_milestones SET compliant_days_required = milestone_order * 7;
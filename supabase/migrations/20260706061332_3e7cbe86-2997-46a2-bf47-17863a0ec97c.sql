
CREATE TABLE IF NOT EXISTS public.channel_partner_slot_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.channel_partners(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.channel_partner_packages(id) ON DELETE CASCADE,
  package_type text NOT NULL CHECK (package_type IN ('group','private')),
  label text NOT NULL,
  time_of_day time NOT NULL,
  duration_min int NOT NULL DEFAULT 60,
  days_of_week int[] NOT NULL DEFAULT '{}'::int[],
  start_date date NOT NULL,
  weeks_count int NOT NULL DEFAULT 4,
  meet_link text,
  capacity int NOT NULL DEFAULT 10,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_partner_slot_templates TO authenticated;
GRANT ALL ON public.channel_partner_slot_templates TO service_role;

ALTER TABLE public.channel_partner_slot_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners manage own slot templates"
ON public.channel_partner_slot_templates
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.channel_partners cp WHERE cp.id = channel_partner_slot_templates.partner_id AND cp.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.channel_partners cp WHERE cp.id = channel_partner_slot_templates.partner_id AND cp.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Authenticated can view active slot templates"
ON public.channel_partner_slot_templates
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE TRIGGER update_slot_templates_updated_at
BEFORE UPDATE ON public.channel_partner_slot_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.channel_partner_slots
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.channel_partner_slot_templates(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS template_label text;

CREATE INDEX IF NOT EXISTS idx_slots_template ON public.channel_partner_slots(template_id);

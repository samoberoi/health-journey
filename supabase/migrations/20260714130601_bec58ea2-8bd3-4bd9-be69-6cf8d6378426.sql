ALTER TABLE public.supplement_categories ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE public.supplement_conditions ADD COLUMN IF NOT EXISTS icon text;

CREATE OR REPLACE FUNCTION public.rename_supplement_condition(_old_key text, _new_key text, _new_label text, _new_icon text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.supplement_conditions SET key=_new_key, label=_new_label, icon=COALESCE(_new_icon, icon) WHERE key=_old_key; END; $$;

CREATE OR REPLACE FUNCTION public.rename_supplement_category(_old_key text, _new_key text, _new_label text, _new_icon text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.supplement_categories SET key=_new_key, label=_new_label, icon=COALESCE(_new_icon, icon) WHERE key=_old_key; END; $$;

GRANT EXECUTE ON FUNCTION public.rename_supplement_condition(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_supplement_category(text,text,text,text) TO authenticated;
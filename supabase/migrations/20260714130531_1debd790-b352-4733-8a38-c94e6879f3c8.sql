DROP FUNCTION IF EXISTS public.rename_supplement_category(text,text,text);
DROP FUNCTION IF EXISTS public.delete_supplement_category(text);
DROP FUNCTION IF EXISTS public.rename_supplement_condition(text,text,text);
DROP FUNCTION IF EXISTS public.delete_supplement_condition(text);

CREATE OR REPLACE FUNCTION public.rename_supplement_category(_old_key text, _new_key text, _new_label text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.supplement_categories SET key = _new_key, label = _new_label WHERE key = _old_key; END; $$;

CREATE OR REPLACE FUNCTION public.delete_supplement_category(_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.supplement_categories SET is_active = false WHERE key = _key; END; $$;

CREATE OR REPLACE FUNCTION public.rename_supplement_condition(_old_key text, _new_key text, _new_label text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.supplement_conditions SET key = _new_key, label = _new_label WHERE key = _old_key; END; $$;

CREATE OR REPLACE FUNCTION public.delete_supplement_condition(_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.supplement_conditions SET is_active = false WHERE key = _key; END; $$;

GRANT EXECUTE ON FUNCTION public.rename_supplement_category(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_supplement_category(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_supplement_condition(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_supplement_condition(text) TO authenticated;
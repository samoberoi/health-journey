
DO $$
DECLARE new_mod_id uuid;
BEGIN
  INSERT INTO public.color_gauge_modules (module_key, module_name, description, unit, higher_is_better, comparison_mode, sort_order, is_active)
  VALUES ('weight', 'Weight (vs baseline)', 'Weight change relative to the user''s starting weight. Negative % = weight loss.', '% vs baseline', false, 'absolute', 15, true)
  ON CONFLICT (module_key) DO UPDATE SET module_name = EXCLUDED.module_name
  RETURNING id INTO new_mod_id;

  -- Only seed bands if none exist yet for this module
  IF NOT EXISTS (SELECT 1 FROM public.color_gauge_bands WHERE module_id = new_mod_id) THEN
    INSERT INTO public.color_gauge_bands (module_id, label, min_value, max_value, color_hex, sort_order) VALUES
      (new_mod_id, 'Excellent (5%+ loss)', -100, -5, '#10B981', 1),
      (new_mod_id, 'On track (2–5% loss)', -5, -2, '#84CC16', 2),
      (new_mod_id, 'Holding (±2%)', -2, 2, '#F59E0B', 3),
      (new_mod_id, 'Gaining (2–5%)', 2, 5, '#EF4444', 4),
      (new_mod_id, 'Concerning (5%+ gain)', 5, 100, '#7F1D1D', 5);
  END IF;
END $$;

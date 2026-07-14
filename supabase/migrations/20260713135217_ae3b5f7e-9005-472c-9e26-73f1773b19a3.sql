
CREATE OR REPLACE FUNCTION public.generate_diet_plating(_user_id uuid, _diet text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _start date := current_date;
  _diet text;
  _is_vegan boolean;
  _is_veg boolean;
  _is_nonveg boolean;
  _d integer;
  _count integer := 0;
  _slots text[] := ARRAY['first_meal','mid_bite','last_meal'];
  _slot text;
  _plate jsonb;
  _cal integer;
  _items text[];
  _title text;
  _diet_filter text[];
  _use_nonveg boolean;

  _f_protein_veg  uuid := 'a3ff818a-2724-471b-9897-fa7a1c211fe8';
  _f_protein_nv   uuid := '0cc011c9-722a-432a-8115-c8ad313b4b5c';
  _f_dairy        uuid := '8c15f5da-c1d2-4d41-979a-bb8065c77a0c';
  _f_fats         uuid := '7f02216d-7dc7-412c-8977-9202973bc6e5';
  _f_nuts         uuid := 'cc1fc03e-3586-46cc-a19d-3a8abf06e595';
  _f_alt_grain    uuid := 'fb0622d5-9b20-4791-8dac-db300431d8e7';
  _f_veg          uuid := 'edca2671-667e-4ab6-bb9a-91fe373d7dc4';
BEGIN
  IF _diet IS NULL OR length(trim(_diet)) = 0 THEN
    SELECT COALESCE(diet_preference,'mixed') INTO _diet
    FROM public.user_diet_profiles WHERE user_id = _user_id
    ORDER BY updated_at DESC NULLS LAST LIMIT 1;
    IF _diet IS NULL THEN _diet := 'mixed'; END IF;
  ELSE
    _diet := lower(trim(_diet));
    INSERT INTO public.user_diet_profiles (user_id, diet_preference)
    VALUES (_user_id, _diet)
    ON CONFLICT (user_id) DO UPDATE SET diet_preference = EXCLUDED.diet_preference, updated_at = now();
  END IF;

  _is_vegan  := _diet ILIKE '%vegan%';
  _is_veg    := _is_vegan OR (_diet ILIKE '%veg%' AND _diet NOT ILIKE '%non%');
  _is_nonveg := _diet ILIKE '%non%' OR _diet = 'nonveg';

  IF _is_vegan THEN _diet_filter := ARRAY['vegan'];
  ELSIF _is_veg THEN _diet_filter := ARRAY['vegan','veg'];
  ELSE _diet_filter := ARRAY['vegan','veg','non_veg']; END IF;

  DELETE FROM public.diet_platings
   WHERE user_id = _user_id AND plan_start_date = _start;

  FOR _d IN 0..29 LOOP
    _use_nonveg := CASE
      WHEN _is_vegan OR (_is_veg AND NOT _is_nonveg) THEN false
      WHEN _is_nonveg THEN true
      ELSE (_d % 2 = 0)
    END;

    FOREACH _slot IN ARRAY _slots LOOP
      _items := ARRAY[]::text[];
      _cal := CASE _slot WHEN 'first_meal' THEN 420 WHEN 'mid_bite' THEN 180 ELSE 480 END;

      IF _slot = 'first_meal' THEN
        _items := _items || COALESCE((
          SELECT name FROM public.food_items
          WHERE is_active AND recommendation IN ('encourage','moderate')
            AND diet_type::text = ANY(_diet_filter)
            AND filter_id = CASE WHEN _use_nonveg AND NOT _is_vegan THEN _f_protein_nv ELSE _f_protein_veg END
          ORDER BY md5(id::text || _d::text || 'fp') LIMIT 1
        ), 'Eggs');
        _items := _items || COALESCE((
          SELECT name FROM public.food_items
          WHERE is_active AND recommendation IN ('encourage','moderate')
            AND diet_type::text = ANY(_diet_filter)
            AND filter_id = _f_alt_grain
          ORDER BY md5(id::text || _d::text || 'fg') LIMIT 1
        ), 'Oats');
        _items := _items || COALESCE((
          SELECT name FROM public.food_items
          WHERE is_active AND recommendation IN ('encourage','moderate')
            AND diet_type::text = ANY(_diet_filter)
            AND filter_id = _f_fats
          ORDER BY md5(id::text || _d::text || 'ff') LIMIT 1
        ), 'Olive Oil');

      ELSIF _slot = 'mid_bite' THEN
        _items := _items || COALESCE((
          SELECT name FROM public.food_items
          WHERE is_active AND recommendation IN ('encourage','moderate')
            AND diet_type::text = ANY(_diet_filter)
            AND filter_id = _f_nuts
          ORDER BY md5(id::text || _d::text || 'mn') LIMIT 1
        ), 'Almonds');
        _items := _items || COALESCE((
          SELECT name FROM public.food_items
          WHERE is_active AND recommendation IN ('encourage','moderate')
            AND diet_type::text = ANY(_diet_filter)
            AND filter_id = CASE WHEN _is_vegan THEN _f_fats ELSE _f_dairy END
          ORDER BY md5(id::text || _d::text || 'md') LIMIT 1
        ), 'Greek Yogurt');

      ELSE -- last_meal
        _items := _items || COALESCE((
          SELECT name FROM public.food_items
          WHERE is_active AND recommendation IN ('encourage','moderate')
            AND diet_type::text = ANY(_diet_filter)
            AND filter_id = CASE WHEN _use_nonveg AND NOT _is_vegan THEN _f_protein_nv ELSE _f_protein_veg END
          ORDER BY md5(id::text || _d::text || 'lp') LIMIT 1
        ), 'Tofu');
        _items := _items || COALESCE((
          SELECT name FROM public.food_items
          WHERE is_active AND recommendation IN ('encourage','moderate')
            AND diet_type::text = ANY(_diet_filter)
            AND filter_id = _f_veg
          ORDER BY md5(id::text || _d::text || 'lv') LIMIT 1
        ), 'Broccoli');
        _items := _items || COALESCE((
          SELECT name FROM public.food_items
          WHERE is_active AND recommendation IN ('encourage','moderate')
            AND diet_type::text = ANY(_diet_filter)
            AND filter_id = _f_fats
          ORDER BY md5(id::text || _d::text || 'lf') LIMIT 1
        ), 'Avocado');
      END IF;

      _title := array_to_string(_items, ' + ');
      _plate := jsonb_build_object('title', _title, 'items', to_jsonb(_items));

      INSERT INTO public.diet_platings (user_id, plan_start_date, day_index, meal_slot, plate_data, calories)
      VALUES (_user_id, _start, _d, _slot, _plate, _cal);
      _count := _count + 1;
    END LOOP;
  END LOOP;

  RETURN _count;
END;
$function$;

-- One-tap swap: regenerate a single plate from the approved catalog
CREATE OR REPLACE FUNCTION public.swap_diet_plate(_plate_id uuid, _seed integer DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _row public.diet_platings%ROWTYPE;
  _diet text;
  _diet_filter text[];
  _is_vegan boolean; _is_veg boolean; _is_nonveg boolean;
  _use_nonveg boolean;
  _items text[] := ARRAY[]::text[];
  _title text;
  _plate jsonb;
  _seed_txt text := COALESCE(_seed::text, extract(epoch from clock_timestamp())::text);
  _f_protein_veg  uuid := 'a3ff818a-2724-471b-9897-fa7a1c211fe8';
  _f_protein_nv   uuid := '0cc011c9-722a-432a-8115-c8ad313b4b5c';
  _f_dairy        uuid := '8c15f5da-c1d2-4d41-979a-bb8065c77a0c';
  _f_fats         uuid := '7f02216d-7dc7-412c-8977-9202973bc6e5';
  _f_nuts         uuid := 'cc1fc03e-3586-46cc-a19d-3a8abf06e595';
  _f_alt_grain    uuid := 'fb0622d5-9b20-4791-8dac-db300431d8e7';
  _f_veg          uuid := 'edca2671-667e-4ab6-bb9a-91fe373d7dc4';
BEGIN
  SELECT * INTO _row FROM public.diet_platings WHERE id = _plate_id;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Plate not found'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> _row.user_id
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.coach_owns_patient(_row.user_id) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(diet_preference,'mixed') INTO _diet
  FROM public.user_diet_profiles WHERE user_id = _row.user_id
  ORDER BY updated_at DESC NULLS LAST LIMIT 1;
  IF _diet IS NULL THEN _diet := 'mixed'; END IF;

  _is_vegan := _diet ILIKE '%vegan%';
  _is_veg   := _is_vegan OR (_diet ILIKE '%veg%' AND _diet NOT ILIKE '%non%');
  _is_nonveg:= _diet ILIKE '%non%' OR _diet = 'nonveg';
  IF _is_vegan THEN _diet_filter := ARRAY['vegan'];
  ELSIF _is_veg THEN _diet_filter := ARRAY['vegan','veg'];
  ELSE _diet_filter := ARRAY['vegan','veg','non_veg']; END IF;
  _use_nonveg := _is_nonveg OR (NOT _is_veg AND NOT _is_vegan AND (_row.day_index % 2 = 0));

  IF _row.meal_slot = 'first_meal' THEN
    _items := _items || COALESCE((SELECT name FROM public.food_items WHERE is_active AND recommendation IN ('encourage','moderate') AND diet_type::text = ANY(_diet_filter) AND filter_id = CASE WHEN _use_nonveg AND NOT _is_vegan THEN _f_protein_nv ELSE _f_protein_veg END ORDER BY md5(id::text || _seed_txt || 'p') LIMIT 1), 'Eggs');
    _items := _items || COALESCE((SELECT name FROM public.food_items WHERE is_active AND recommendation IN ('encourage','moderate') AND diet_type::text = ANY(_diet_filter) AND filter_id = _f_alt_grain ORDER BY md5(id::text || _seed_txt || 'g') LIMIT 1), 'Oats');
    _items := _items || COALESCE((SELECT name FROM public.food_items WHERE is_active AND recommendation IN ('encourage','moderate') AND diet_type::text = ANY(_diet_filter) AND filter_id = _f_fats ORDER BY md5(id::text || _seed_txt || 'f') LIMIT 1), 'Olive Oil');
  ELSIF _row.meal_slot = 'mid_bite' THEN
    _items := _items || COALESCE((SELECT name FROM public.food_items WHERE is_active AND recommendation IN ('encourage','moderate') AND diet_type::text = ANY(_diet_filter) AND filter_id = _f_nuts ORDER BY md5(id::text || _seed_txt || 'n') LIMIT 1), 'Almonds');
    _items := _items || COALESCE((SELECT name FROM public.food_items WHERE is_active AND recommendation IN ('encourage','moderate') AND diet_type::text = ANY(_diet_filter) AND filter_id = CASE WHEN _is_vegan THEN _f_fats ELSE _f_dairy END ORDER BY md5(id::text || _seed_txt || 'd') LIMIT 1), 'Greek Yogurt');
  ELSE
    _items := _items || COALESCE((SELECT name FROM public.food_items WHERE is_active AND recommendation IN ('encourage','moderate') AND diet_type::text = ANY(_diet_filter) AND filter_id = CASE WHEN _use_nonveg AND NOT _is_vegan THEN _f_protein_nv ELSE _f_protein_veg END ORDER BY md5(id::text || _seed_txt || 'p') LIMIT 1), 'Tofu');
    _items := _items || COALESCE((SELECT name FROM public.food_items WHERE is_active AND recommendation IN ('encourage','moderate') AND diet_type::text = ANY(_diet_filter) AND filter_id = _f_veg ORDER BY md5(id::text || _seed_txt || 'v') LIMIT 1), 'Broccoli');
    _items := _items || COALESCE((SELECT name FROM public.food_items WHERE is_active AND recommendation IN ('encourage','moderate') AND diet_type::text = ANY(_diet_filter) AND filter_id = _f_fats ORDER BY md5(id::text || _seed_txt || 'f') LIMIT 1), 'Avocado');
  END IF;

  _title := array_to_string(_items, ' + ');
  _plate := jsonb_build_object('title', _title, 'items', to_jsonb(_items));
  UPDATE public.diet_platings SET plate_data = _plate WHERE id = _plate_id;
  RETURN _plate;
END;
$function$;

-- Clean up any legacy 4-slot plates so users are on the new 3-slot rhythm
DELETE FROM public.diet_platings WHERE meal_slot IN ('breakfast','lunch','snack','dinner');

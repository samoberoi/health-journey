CREATE OR REPLACE FUNCTION public.generate_diet_plating(_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _start date := current_date;
  _diet text;
  _is_veg boolean;
  _is_vegan boolean;
  _d integer;
  _count integer := 0;
  _slots text[] := ARRAY['breakfast','lunch','snack','dinner'];
  _slot text;
  _plate jsonb;
  _cal integer;
  _bf jsonb; _ln jsonb; _sn jsonb; _dn jsonb;
BEGIN
  SELECT COALESCE(diet_preference,'mixed') INTO _diet
  FROM public.user_diet_profiles WHERE user_id = _user_id
  ORDER BY updated_at DESC NULLS LAST LIMIT 1;
  IF _diet IS NULL THEN _diet := 'mixed'; END IF;
  _is_vegan := _diet ILIKE '%vegan%';
  _is_veg := _is_vegan OR _diet ILIKE '%veg%';

  DELETE FROM public.diet_platings
   WHERE user_id = _user_id AND plan_start_date = _start;

  FOR _d IN 0..29 LOOP
    _bf := CASE WHEN _is_vegan
        THEN jsonb_build_object('title','Oats + chia + berries','items',jsonb_build_array('oats','chia','berries','almond milk'))
        WHEN _is_veg
        THEN jsonb_build_object('title','Veg moong dosa + chutney','items',jsonb_build_array('moong dosa','coconut chutney','curd'))
        ELSE jsonb_build_object('title','3 egg omelette + sourdough','items',jsonb_build_array('eggs','sourdough','greens'))
      END;
    _ln := CASE WHEN _is_vegan
        THEN jsonb_build_object('title','Quinoa bowl + tofu + veg','items',jsonb_build_array('quinoa','tofu','sauteed veg','hummus'))
        WHEN _is_veg
        THEN jsonb_build_object('title','Roti + dal + sabzi + salad','items',jsonb_build_array('roti','dal','sabzi','salad','curd'))
        ELSE jsonb_build_object('title','Chicken + rice + salad','items',jsonb_build_array('grilled chicken','brown rice','salad'))
      END;
    _sn := jsonb_build_object('title','Nuts + fruit','items',jsonb_build_array('almonds','walnuts','apple'));
    _dn := CASE WHEN _is_vegan
        THEN jsonb_build_object('title','Lentil soup + roasted veg','items',jsonb_build_array('lentil soup','roasted veg'))
        WHEN _is_veg
        THEN jsonb_build_object('title','Paneer bhurji + roti','items',jsonb_build_array('paneer bhurji','roti','salad'))
        ELSE jsonb_build_object('title','Grilled fish + veg','items',jsonb_build_array('fish','steamed veg','quinoa'))
      END;

    FOREACH _slot IN ARRAY _slots LOOP
      _plate := CASE _slot
        WHEN 'breakfast' THEN _bf
        WHEN 'lunch' THEN _ln
        WHEN 'snack' THEN _sn
        WHEN 'dinner' THEN _dn
      END;
      _cal := CASE _slot WHEN 'breakfast' THEN 380 WHEN 'lunch' THEN 520 WHEN 'snack' THEN 180 ELSE 460 END;

      INSERT INTO public.diet_platings (user_id, plan_start_date, day_index, meal_slot, plate_data, calories)
      VALUES (_user_id, _start, _d, _slot, _plate, _cal);
      _count := _count + 1;
    END LOOP;
  END LOOP;

  RETURN _count;
END;
$function$;
CREATE OR REPLACE FUNCTION public.generate_diet_plating(_user_id uuid, _diet text DEFAULT NULL)
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
  _is_nonveg boolean;
  _d integer;
  _count integer := 0;
  _slots text[] := ARRAY['breakfast','lunch','snack','dinner'];
  _slot text;
  _plate jsonb;
  _cal integer;
  _bf jsonb; _ln jsonb; _sn jsonb; _dn jsonb;
  _bf_pool jsonb[]; _ln_pool jsonb[]; _sn_pool jsonb[]; _dn_pool jsonb[];
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

  _is_vegan := _diet ILIKE '%vegan%';
  _is_veg := _is_vegan OR (_diet ILIKE '%veg%' AND _diet NOT ILIKE '%non%');
  _is_nonveg := _diet ILIKE '%non%' OR _diet = 'nonveg';

  -- Pools per slot; 'mixed' pulls across categories so a day can have both veg and non-veg meals
  IF _is_vegan THEN
    _bf_pool := ARRAY[
      jsonb_build_object('title','Oats + chia + berries','items',jsonb_build_array('oats','chia','berries','almond milk')),
      jsonb_build_object('title','Tofu scramble + toast','items',jsonb_build_array('tofu','sourdough','spinach')),
      jsonb_build_object('title','Ragi porridge + banana','items',jsonb_build_array('ragi','banana','flax'))
    ];
    _ln_pool := ARRAY[
      jsonb_build_object('title','Quinoa bowl + tofu + veg','items',jsonb_build_array('quinoa','tofu','sauteed veg','hummus')),
      jsonb_build_object('title','Chickpea salad + pita','items',jsonb_build_array('chickpeas','cucumber','tomato','pita')),
      jsonb_build_object('title','Rajma + brown rice','items',jsonb_build_array('rajma','brown rice','salad'))
    ];
    _sn_pool := ARRAY[
      jsonb_build_object('title','Nuts + fruit','items',jsonb_build_array('almonds','walnuts','apple')),
      jsonb_build_object('title','Hummus + carrots','items',jsonb_build_array('hummus','carrot','celery')),
      jsonb_build_object('title','Roasted chana','items',jsonb_build_array('roasted chana','pumpkin seeds'))
    ];
    _dn_pool := ARRAY[
      jsonb_build_object('title','Lentil soup + roasted veg','items',jsonb_build_array('lentil soup','roasted veg')),
      jsonb_build_object('title','Tempeh stir-fry + rice','items',jsonb_build_array('tempeh','bell peppers','brown rice')),
      jsonb_build_object('title','Mushroom curry + roti','items',jsonb_build_array('mushroom','onion','roti'))
    ];
  ELSIF _is_veg THEN
    _bf_pool := ARRAY[
      jsonb_build_object('title','Veg moong dosa + chutney','items',jsonb_build_array('moong dosa','coconut chutney','curd')),
      jsonb_build_object('title','Paneer paratha + curd','items',jsonb_build_array('paneer paratha','curd','pickle')),
      jsonb_build_object('title','Poha + peanuts','items',jsonb_build_array('poha','peanuts','curry leaves'))
    ];
    _ln_pool := ARRAY[
      jsonb_build_object('title','Roti + dal + sabzi + salad','items',jsonb_build_array('roti','dal','sabzi','salad','curd')),
      jsonb_build_object('title','Kadhi + rice + salad','items',jsonb_build_array('kadhi','rice','salad')),
      jsonb_build_object('title','Paneer curry + roti','items',jsonb_build_array('paneer','tomato gravy','roti'))
    ];
    _sn_pool := ARRAY[
      jsonb_build_object('title','Nuts + fruit','items',jsonb_build_array('almonds','walnuts','apple')),
      jsonb_build_object('title','Sprouts chaat','items',jsonb_build_array('sprouts','onion','lemon')),
      jsonb_build_object('title','Curd + fruit','items',jsonb_build_array('curd','papaya','chia'))
    ];
    _dn_pool := ARRAY[
      jsonb_build_object('title','Paneer bhurji + roti','items',jsonb_build_array('paneer bhurji','roti','salad')),
      jsonb_build_object('title','Veg khichdi + curd','items',jsonb_build_array('moong khichdi','curd','ghee')),
      jsonb_build_object('title','Palak paneer + roti','items',jsonb_build_array('palak paneer','roti'))
    ];
  ELSIF _is_nonveg THEN
    _bf_pool := ARRAY[
      jsonb_build_object('title','3 egg omelette + sourdough','items',jsonb_build_array('eggs','sourdough','greens')),
      jsonb_build_object('title','Chicken keema + roti','items',jsonb_build_array('chicken keema','roti','onion')),
      jsonb_build_object('title','Egg bhurji + toast','items',jsonb_build_array('eggs','tomato','onion','toast'))
    ];
    _ln_pool := ARRAY[
      jsonb_build_object('title','Chicken + rice + salad','items',jsonb_build_array('grilled chicken','brown rice','salad')),
      jsonb_build_object('title','Fish curry + rice','items',jsonb_build_array('fish curry','rice','beans')),
      jsonb_build_object('title','Chicken tikka + roti','items',jsonb_build_array('chicken tikka','roti','salad'))
    ];
    _sn_pool := ARRAY[
      jsonb_build_object('title','Boiled eggs + fruit','items',jsonb_build_array('boiled eggs','apple')),
      jsonb_build_object('title','Nuts + fruit','items',jsonb_build_array('almonds','walnuts','banana')),
      jsonb_build_object('title','Greek yogurt + berries','items',jsonb_build_array('greek yogurt','berries'))
    ];
    _dn_pool := ARRAY[
      jsonb_build_object('title','Grilled fish + veg','items',jsonb_build_array('fish','steamed veg','quinoa')),
      jsonb_build_object('title','Chicken stew + appam','items',jsonb_build_array('chicken stew','appam')),
      jsonb_build_object('title','Prawn masala + rice','items',jsonb_build_array('prawns','onion','rice'))
    ];
  ELSE
    -- MIXED: intentionally spans veg + non-veg
    _bf_pool := ARRAY[
      jsonb_build_object('title','3 egg omelette + sourdough','items',jsonb_build_array('eggs','sourdough','greens')),
      jsonb_build_object('title','Paneer paratha + curd','items',jsonb_build_array('paneer paratha','curd','pickle')),
      jsonb_build_object('title','Oats + chia + berries','items',jsonb_build_array('oats','chia','berries','almond milk')),
      jsonb_build_object('title','Chicken keema + roti','items',jsonb_build_array('chicken keema','roti','onion')),
      jsonb_build_object('title','Poha + peanuts','items',jsonb_build_array('poha','peanuts','curry leaves'))
    ];
    _ln_pool := ARRAY[
      jsonb_build_object('title','Grilled chicken + rice + salad','items',jsonb_build_array('grilled chicken','brown rice','salad')),
      jsonb_build_object('title','Roti + dal + sabzi + salad','items',jsonb_build_array('roti','dal','sabzi','salad','curd')),
      jsonb_build_object('title','Fish curry + rice','items',jsonb_build_array('fish curry','rice','beans')),
      jsonb_build_object('title','Paneer curry + roti','items',jsonb_build_array('paneer','tomato gravy','roti')),
      jsonb_build_object('title','Rajma + brown rice','items',jsonb_build_array('rajma','brown rice','salad'))
    ];
    _sn_pool := ARRAY[
      jsonb_build_object('title','Nuts + fruit','items',jsonb_build_array('almonds','walnuts','apple')),
      jsonb_build_object('title','Boiled eggs + fruit','items',jsonb_build_array('boiled eggs','apple')),
      jsonb_build_object('title','Sprouts chaat','items',jsonb_build_array('sprouts','onion','lemon')),
      jsonb_build_object('title','Greek yogurt + berries','items',jsonb_build_array('greek yogurt','berries'))
    ];
    _dn_pool := ARRAY[
      jsonb_build_object('title','Grilled fish + veg','items',jsonb_build_array('fish','steamed veg','quinoa')),
      jsonb_build_object('title','Paneer bhurji + roti','items',jsonb_build_array('paneer bhurji','roti','salad')),
      jsonb_build_object('title','Chicken stew + appam','items',jsonb_build_array('chicken stew','appam')),
      jsonb_build_object('title','Palak paneer + roti','items',jsonb_build_array('palak paneer','roti')),
      jsonb_build_object('title','Lentil soup + roasted veg','items',jsonb_build_array('lentil soup','roasted veg'))
    ];
  END IF;

  DELETE FROM public.diet_platings
   WHERE user_id = _user_id AND plan_start_date = _start;

  FOR _d IN 0..29 LOOP
    _bf := _bf_pool[1 + (_d % array_length(_bf_pool,1))];
    _ln := _ln_pool[1 + (_d % array_length(_ln_pool,1))];
    _sn := _sn_pool[1 + (_d % array_length(_sn_pool,1))];
    _dn := _dn_pool[1 + (_d % array_length(_dn_pool,1))];

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
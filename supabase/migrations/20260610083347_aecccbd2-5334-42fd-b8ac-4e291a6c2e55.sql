
DO $$
DECLARE
  v_sweets UUID; v_pulses UUID; v_milk UUID; v_fruits UUID;
  v_lean_nv UUID; v_veg_protein UUID; v_fats UUID; v_veggies UUID;
  v_alt_grain UUID; v_nuts UUID; v_addons UUID;
BEGIN
  SELECT id INTO v_sweets    FROM public.food_filters WHERE slug='sweets_and_sweeteners';
  SELECT id INTO v_pulses    FROM public.food_filters WHERE slug='pulses_and_legumes';
  SELECT id INTO v_milk      FROM public.food_filters WHERE slug='milk_and_milk_sugars';
  SELECT id INTO v_fruits    FROM public.food_filters WHERE slug='fruits_and_fruit_sugars';
  SELECT id INTO v_lean_nv   FROM public.food_filters WHERE slug='lean_proteins_non_veg';
  SELECT id INTO v_veg_protein FROM public.food_filters WHERE slug='vegetarian_vegan_proteins';
  SELECT id INTO v_fats      FROM public.food_filters WHERE slug='healthy_fats';
  SELECT id INTO v_veggies   FROM public.food_filters WHERE slug='vegetables';
  SELECT id INTO v_alt_grain FROM public.food_filters WHERE slug='rice_wheat_alternatives';
  SELECT id INTO v_nuts      FROM public.food_filters WHERE slug='nuts_and_seeds';
  SELECT id INTO v_addons    FROM public.food_filters WHERE slug='metabolic_support_addons';

  INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_band, protein_g, fat_g, calories_kcal, recommendation, health_benefits, notes, is_jain_friendly, is_dairy_free, display_order)
  SELECT v_lean_nv, x.name, x.alt, 'non_veg'::public.food_diet_type, 'cooked'::public.food_serving_basis, 0, 0, 'low'::public.food_gi_band, x.p, x.f, x.kcal, 'encourage'::public.food_recommendation, x.benefits, x.notes, false, true, COALESCE((SELECT MAX(display_order) FROM public.food_items WHERE filter_id=v_lean_nv),0) + x.ord
  FROM (VALUES
    ('Salmon','Atlantic / Pink',22,13,208,ARRAY['Omega-3 DHA/EPA','Anti-inflammatory'],'Pan-sear or bake; avoid breaded preps.',1),
    ('Sardines','Tinned in olive oil',24,11,208,ARRAY['Omega-3','Vitamin D','Calcium'],'Choose tins in olive oil/water, not sunflower oil.',2),
    ('Tuna','Yellowfin / Skipjack',28,1,132,ARRAY['Lean protein','Selenium'],'Limit canned-in-oil; prefer water-packed.',3),
    ('Pomfret','Indian Silver Pomfret',21,5,140,ARRAY['Lean fish protein'],'Indian coastal staple, low mercury.',4),
    ('Surmai (Kingfish)','Seer fish',22,4,130,ARRAY['Lean protein','Selenium'],NULL,5),
    ('Tilapia',NULL,26,3,128,ARRAY['Lean white fish'],'Choose farmed responsibly.',6),
    ('Turkey Breast','Skinless',29,1,135,ARRAY['Very low fat protein'],NULL,7),
    ('Egg Whites',NULL,11,0,52,ARRAY['Pure protein','Zero carb'],'Good post-workout option.',8)
  ) AS x(name, alt, p, f, kcal, benefits, notes, ord)
  WHERE NOT EXISTS (SELECT 1 FROM public.food_items WHERE filter_id=v_lean_nv AND name=x.name);

  INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_band, protein_g, fat_g, fiber_g, calories_kcal, recommendation, health_benefits, notes, is_jain_friendly, is_dairy_free, display_order)
  SELECT v_veg_protein, x.name, x.alt, x.dt::public.food_diet_type, 'cooked'::public.food_serving_basis, x.c, x.c, 'low'::public.food_gi_band, x.p, x.f, x.fib, x.kcal, 'encourage'::public.food_recommendation, x.benefits, x.notes, x.jain, x.df, COALESCE((SELECT MAX(display_order) FROM public.food_items WHERE filter_id=v_veg_protein),0) + x.ord
  FROM (VALUES
    ('Tempeh','Fermented soy',9,19,11,6,192,'vegan',ARRAY['Probiotic','Complete protein'],'Fermented — easier on digestion than tofu.',true,true,1),
    ('Soy Chunks','Nutrela/TVP',33,52,0,13,345,'vegan',ARRAY['Highest plant protein per gram'],'Hydrate; pair with vegetables.',true,true,2),
    ('Hemp Seeds',NULL,3,31,49,4,553,'vegan',ARRAY['Complete protein','Omega-3'],'Sprinkle on salads or smoothies.',true,true,3),
    ('Sprouted Moong','Mung sprouts',6,3,0,2,30,'vegan',ARRAY['Live enzymes','High fiber'],'Eat lightly steamed for digestion.',true,true,4),
    ('Pumpkin Seed Protein',NULL,5,60,6,8,380,'vegan',ARRAY['Iron-rich','Magnesium'],NULL,true,true,5),
    ('Whey Protein Isolate',NULL,2,90,1,0,380,'veg',ARRAY['Fast-absorbing protein'],'Choose unsweetened, no maltodextrin.',true,false,6),
    ('Egg-white Powder',NULL,4,82,0,0,380,'veg',ARRAY['Lactose-free protein'],NULL,false,true,7)
  ) AS x(name, alt, c, p, fib, f, kcal, dt, benefits, notes, jain, df, ord)
  WHERE NOT EXISTS (SELECT 1 FROM public.food_items WHERE filter_id=v_veg_protein AND name=x.name);

  INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_band, fat_g, calories_kcal, recommendation, health_benefits, notes, is_jain_friendly, is_dairy_free, display_order)
  SELECT v_fats, x.name, x.alt, x.dt::public.food_diet_type, 'per_100g'::public.food_serving_basis, 0, 0, 'low'::public.food_gi_band, x.f, x.kcal, x.rec::public.food_recommendation, x.benefits, x.notes, x.jain, x.df, COALESCE((SELECT MAX(display_order) FROM public.food_items WHERE filter_id=v_fats),0) + x.ord
  FROM (VALUES
    ('Fish Oil','EPA + DHA capsules',100,902,'non_veg','encourage',ARRAY['Omega-3','Cardio-protective'],'1–2 g EPA+DHA/day.',false,true,1),
    ('Algae Oil','Vegan DHA',100,884,'vegan','encourage',ARRAY['Vegan omega-3 (DHA)'],NULL,true,true,2),
    ('Coconut Cream','Unsweetened',24,230,'vegan','moderate',ARRAY['MCTs','Satiety'],'Watch portion if losing weight.',true,true,3),
    ('Almond Butter','Unsweetened',56,614,'vegan','moderate',ARRAY['Vitamin E','Magnesium'],'No added oils or sugar.',true,true,4),
    ('Pumpkin Seed Oil',NULL,100,884,'vegan','encourage',ARRAY['Zinc precursor','Prostate health'],NULL,true,true,5),
    ('Walnut Oil',NULL,100,884,'vegan','encourage',ARRAY['ALA omega-3'],'Use cold; do not heat.',true,true,6)
  ) AS x(name, alt, f, kcal, dt, rec, benefits, notes, jain, df, ord)
  WHERE NOT EXISTS (SELECT 1 FROM public.food_items WHERE filter_id=v_fats AND name=x.name);

  INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_band, fiber_g, calories_kcal, recommendation, health_benefits, notes, is_jain_friendly, is_dairy_free, display_order)
  SELECT v_veggies, x.name, x.alt, 'vegan'::public.food_diet_type, 'raw'::public.food_serving_basis, x.c, x.c, x.gi::public.food_gi_band, x.fib, x.kcal, 'encourage'::public.food_recommendation, x.benefits, x.notes, x.jain, true, COALESCE((SELECT MAX(display_order) FROM public.food_items WHERE filter_id=v_veggies),0) + x.ord
  FROM (VALUES
    ('Spinach','Palak',4,'low',2,23,ARRAY['Iron','Folate','Magnesium'],NULL,true,1),
    ('Kale',NULL,9,'low',4,49,ARRAY['Vitamin K','Antioxidants'],NULL,true,2),
    ('Bottle Gourd','Lauki',4,'low',1,14,ARRAY['Hydrating','Low calorie'],NULL,true,3),
    ('Ridge Gourd','Turai',4,'low',1,17,ARRAY['Liver support'],NULL,true,4),
    ('Bitter Gourd','Karela',4,'low',3,17,ARRAY['Charantin lowers glucose'],'Excellent for insulin sensitivity.',true,5),
    ('Cauliflower','Phoolgobi',5,'low',2,25,ARRAY['Sulforaphane'],NULL,true,6),
    ('Cabbage','Patta gobhi',6,'low',3,25,ARRAY['Vitamin C'],NULL,true,7),
    ('Capsicum','Bell pepper',6,'low',2,31,ARRAY['Vitamin C'],NULL,true,8),
    ('Cucumber','Kheera',4,'low',1,16,ARRAY['Hydrating'],NULL,true,9),
    ('Zucchini',NULL,3,'low',1,17,ARRAY['Low carb pasta swap'],NULL,true,10),
    ('Asparagus',NULL,4,'low',2,20,ARRAY['Folate','Prebiotic'],NULL,true,11),
    ('Mushrooms','Button',3,'low',1,22,ARRAY['B vitamins','Vegan vit-D'],'Sun-exposed mushrooms add vitamin D.',false,12),
    ('Drumstick','Moringa pods',8,'low',3,37,ARRAY['Antioxidants'],NULL,true,13)
  ) AS x(name, alt, c, gi, fib, kcal, benefits, notes, jain, ord)
  WHERE NOT EXISTS (SELECT 1 FROM public.food_items WHERE filter_id=v_veggies AND name=x.name);

  INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_band, protein_g, fat_g, fiber_g, calories_kcal, recommendation, health_benefits, notes, is_jain_friendly, is_dairy_free, display_order)
  SELECT v_nuts, x.name, x.alt, 'vegan'::public.food_diet_type, 'per_100g'::public.food_serving_basis, x.c, x.c, 'low'::public.food_gi_band, x.p, x.f, x.fib, x.kcal, 'encourage'::public.food_recommendation, x.benefits, x.notes, true, true, COALESCE((SELECT MAX(display_order) FROM public.food_items WHERE filter_id=v_nuts),0) + x.ord
  FROM (VALUES
    ('Brazil Nuts',NULL,12,14,67,8,659,ARRAY['Selenium (1 nut = day''s need)'],'1–2 per day max.',1),
    ('Pecans',NULL,14,9,72,10,691,ARRAY['Antioxidants'],NULL,2),
    ('Macadamias',NULL,14,8,76,9,718,ARRAY['Monounsaturated fats'],NULL,3),
    ('Sesame Seeds','Til',23,18,50,12,573,ARRAY['Calcium','Lignans'],NULL,4),
    ('Sunflower Seeds',NULL,20,21,51,9,584,ARRAY['Vitamin E'],NULL,5),
    ('Watermelon Seeds','Magaz',15,28,47,0,557,ARRAY['Magnesium','Zinc'],NULL,6),
    ('Basil Seeds','Sabja',42,14,25,40,233,ARRAY['Soluble fiber','Cooling'],'Soak in water; expands 10×.',7)
  ) AS x(name, alt, c, p, f, fib, kcal, benefits, notes, ord)
  WHERE NOT EXISTS (SELECT 1 FROM public.food_items WHERE filter_id=v_nuts AND name=x.name);

  INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_band, recommendation, health_benefits, notes, is_jain_friendly, is_dairy_free, display_order)
  SELECT v_addons, x.name, x.alt, 'vegan'::public.food_diet_type, 'raw'::public.food_serving_basis, 0, 0, 'low'::public.food_gi_band, 'encourage'::public.food_recommendation, x.benefits, x.notes, x.jain, true, COALESCE((SELECT MAX(display_order) FROM public.food_items WHERE filter_id=v_addons),0) + x.ord
  FROM (VALUES
    ('Black Cumin','Kalonji',ARRAY['Thymoquinone','Glucose support'],'½ tsp daily.',true,1),
    ('Black Pepper','Kali mirch',ARRAY['Piperine boosts curcumin absorption'],NULL,true,2),
    ('Coriander Seeds','Dhania',ARRAY['Diuretic','Glucose support'],NULL,true,3),
    ('Curry Leaves','Kadi patta',ARRAY['Iron','Glucose support'],NULL,true,4),
    ('Green Tea','Matcha',ARRAY['EGCG','Insulin sensitivity'],'2–3 cups/day.',true,5),
    ('Hibiscus Tea',NULL,ARRAY['BP lowering','Antioxidant'],NULL,true,6),
    ('Lemon','Nimbu',ARRAY['Vitamin C','Slows gastric emptying'],'Warm water + lemon AM.',true,7),
    ('Cardamom','Elaichi',ARRAY['Anti-inflammatory'],NULL,true,8),
    ('Clove','Laung',ARRAY['Eugenol','Glucose support'],NULL,true,9)
  ) AS x(name, alt, benefits, notes, jain, ord)
  WHERE NOT EXISTS (SELECT 1 FROM public.food_items WHERE filter_id=v_addons AND name=x.name);

  INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_band, gi_min, gi_max, fiber_g, calories_kcal, recommendation, health_benefits, notes, is_jain_friendly, is_dairy_free, display_order)
  SELECT v_alt_grain, x.name, x.alt, 'vegan'::public.food_diet_type, 'cooked'::public.food_serving_basis, x.c, x.c, x.gi::public.food_gi_band, x.gimin, x.gimax, x.fib, x.kcal, x.rec::public.food_recommendation, x.benefits, x.notes, true, true, COALESCE((SELECT MAX(display_order) FROM public.food_items WHERE filter_id=v_alt_grain),0) + x.ord
  FROM (VALUES
    ('Foxtail Millet','Kangni',25,'low_med',50,55,6,351,'encourage',ARRAY['Magnesium','Slow GI'],NULL,1),
    ('Barnyard Millet','Samak',25,'low_med',50,55,10,307,'encourage',ARRAY['Highest fiber millet'],NULL,2),
    ('Little Millet','Kutki',25,'low_med',50,54,8,329,'encourage',ARRAY['Iron','B-vitamins'],NULL,3),
    ('Kodo Millet',NULL,24,'low_med',50,55,9,309,'encourage',ARRAY['Diabetes-friendly grain'],NULL,4),
    ('Brown Rice',NULL,23,'medium',55,68,2,111,'moderate',ARRAY['Whole grain'],'Portion-control; still raises glucose.',5),
    ('Black Rice','Forbidden rice',22,'low_med',42,50,3,130,'encourage',ARRAY['Anthocyanins'],NULL,6),
    ('Buckwheat','Kuttu',21,'low_med',45,54,4,343,'encourage',ARRAY['Pseudo-grain','Rutin'],NULL,7),
    ('Amaranth','Rajgira',19,'medium',60,65,3,102,'moderate',ARRAY['Complete protein'],NULL,8)
  ) AS x(name, alt, c, gi, gimin, gimax, fib, kcal, rec, benefits, notes, ord)
  WHERE NOT EXISTS (SELECT 1 FROM public.food_items WHERE filter_id=v_alt_grain AND name=x.name);

  INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_band, gi_min, gi_max, fiber_g, calories_kcal, recommendation, health_benefits, is_jain_friendly, is_dairy_free, display_order, extra)
  SELECT v_fruits, x.name, x.alt, 'vegan'::public.food_diet_type, 'raw'::public.food_serving_basis, x.c, x.c, x.gi::public.food_gi_band, x.gimin, x.gimax, x.fib, x.kcal, x.rec::public.food_recommendation, x.benefits, true, true, COALESCE((SELECT MAX(display_order) FROM public.food_items WHERE filter_id=v_fruits),0) + x.ord, jsonb_build_object('sugar_group', x.sg)
  FROM (VALUES
    ('Blueberries',NULL,14,'low',53,53,2,57,'encourage',ARRAY['Anthocyanins'],'lower',1),
    ('Raspberries',NULL,12,'low',32,32,7,52,'encourage',ARRAY['Highest fiber berry'],'lower',2),
    ('Strawberries',NULL,8,'low',40,40,2,32,'encourage',ARRAY['Vitamin C'],'lower',3),
    ('Avocado','Counted as fat',9,'low',15,15,7,160,'encourage',ARRAY['Monounsaturated fats'],'lower',4),
    ('Kiwi',NULL,15,'low_med',50,53,3,61,'moderate',ARRAY['Vitamin C','Actinidin'],'lower',5),
    ('Guava','Amrood',14,'low',30,40,5,68,'encourage',ARRAY['High fiber','Vitamin C'],'lower',6),
    ('Papaya','Papita',11,'low_med',56,60,2,43,'moderate',ARRAY['Papain enzyme'],'lower',7),
    ('Watermelon','Tarbooz',8,'high',72,76,0,30,'limit',ARRAY['Hydrating'],'higher',8),
    ('Pineapple','Ananas',13,'med_high',59,66,1,50,'limit',ARRAY['Bromelain'],'higher',9),
    ('Pear','Nashpati',15,'low',38,38,3,57,'encourage',ARRAY['Fiber-rich'],'lower',10)
  ) AS x(name, alt, c, gi, gimin, gimax, fib, kcal, rec, benefits, sg, ord)
  WHERE NOT EXISTS (SELECT 1 FROM public.food_items WHERE filter_id=v_fruits AND name=x.name);

  INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_band, gi_min, gi_max, fiber_g, protein_g, calories_kcal, recommendation, health_benefits, is_jain_friendly, is_dairy_free, display_order)
  SELECT v_pulses, x.name, x.alt, 'vegan'::public.food_diet_type, 'cooked'::public.food_serving_basis, x.c, x.c, x.gi::public.food_gi_band, x.gimin, x.gimax, x.fib, x.p, x.kcal, 'moderate'::public.food_recommendation, x.benefits, true, true, COALESCE((SELECT MAX(display_order) FROM public.food_items WHERE filter_id=v_pulses),0) + x.ord
  FROM (VALUES
    ('Black Chickpeas','Kala chana',27,'low_med',28,33,8,9,164,ARRAY['Fiber','Iron'],1),
    ('Black Beans',NULL,23,'low',30,30,9,9,132,ARRAY['Anthocyanins'],2),
    ('Pinto Beans',NULL,26,'low_med',33,39,9,9,143,ARRAY['Folate'],3),
    ('Soybeans','Bhatt',11,'low',15,18,6,17,173,ARRAY['Complete protein'],4),
    ('Horse Gram','Kulthi',57,'low',30,35,5,22,321,ARRAY['Kidney stones','Insulin sensitivity'],5)
  ) AS x(name, alt, c, gi, gimin, gimax, fib, p, kcal, benefits, ord)
  WHERE NOT EXISTS (SELECT 1 FROM public.food_items WHERE filter_id=v_pulses AND name=x.name);

  INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_band, gi_min, gi_max, protein_g, calories_kcal, recommendation, health_benefits, notes, is_jain_friendly, is_dairy_free, display_order, extra)
  SELECT v_milk, x.name, x.alt, x.dt::public.food_diet_type, 'per_100ml'::public.food_serving_basis, x.c, x.c, x.gi::public.food_gi_band, x.gimin, x.gimax, x.p, x.kcal, x.rec::public.food_recommendation, x.benefits, x.notes, x.jain, x.df, COALESCE((SELECT MAX(display_order) FROM public.food_items WHERE filter_id=v_milk),0) + x.ord, jsonb_build_object('is_lactose_free', x.lf, 'alternative', x.altmilk)
  FROM (VALUES
    ('Macadamia Milk','Unsweetened','vegan',1,'low',20,25,1,25,'encourage',ARRAY['Very low carb'],NULL,true,true,true,true,1),
    ('Hemp Milk','Unsweetened','vegan',1,'low',20,25,2,46,'encourage',ARRAY['Omega-3'],NULL,true,true,true,true,2),
    ('Cashew Milk','Unsweetened','vegan',1,'low',20,25,1,25,'encourage',ARRAY['Creamy','Low carb'],NULL,true,true,true,true,3),
    ('A2 Cow Milk',NULL,'veg',5,'low_med',30,36,3,65,'moderate',ARRAY['Easier digestion'],'Still contains lactose.',false,false,false,false,4),
    ('Camel Milk',NULL,'veg',5,'low_med',30,35,4,60,'moderate',ARRAY['Lower lactose','Insulin-like protein'],NULL,false,false,false,false,5)
  ) AS x(name, alt, dt, c, gi, gimin, gimax, p, kcal, rec, benefits, notes, jain, df, lf, altmilk, ord)
  WHERE NOT EXISTS (SELECT 1 FROM public.food_items WHERE filter_id=v_milk AND name=x.name);

  INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_band, gi_min, gi_max, recommendation, health_benefits, notes, is_jain_friendly, is_dairy_free, display_order)
  SELECT v_sweets, x.name, x.alt, 'vegan'::public.food_diet_type, 'per_100g'::public.food_serving_basis, x.c, x.c, x.gi::public.food_gi_band, x.gimin, x.gimax, x.rec::public.food_recommendation, x.benefits, x.notes, true, true, COALESCE((SELECT MAX(display_order) FROM public.food_items WHERE filter_id=v_sweets),0) + x.ord
  FROM (VALUES
    ('Stevia','Leaf extract',0,'low',0,0,'encourage',ARRAY['Zero glycemic','Zero calorie'],'Choose green leaf or pure steviol glycosides.',1),
    ('Monk Fruit','Luo han guo',0,'low',0,0,'encourage',ARRAY['Zero glycemic'],NULL,2),
    ('Erythritol',NULL,100,'low',0,0,'encourage',ARRAY['Sugar alcohol','Tooth-friendly'],'May cause GI discomfort in excess.',3),
    ('Allulose',NULL,100,'low',0,1,'encourage',ARRAY['Tastes like sugar','Minimal absorption'],NULL,4),
    ('Xylitol',NULL,100,'low_med',7,13,'moderate',ARRAY['Lower GI than sugar'],'Toxic to dogs.',5),
    ('Agave Syrup',NULL,82,'low',15,15,'avoid',ARRAY[]::TEXT[],'~85% fructose — bad for liver.',6),
    ('Brown Sugar',NULL,97,'high',64,64,'avoid',ARRAY[]::TEXT[],'Same impact as white sugar.',7)
  ) AS x(name, alt, c, gi, gimin, gimax, rec, benefits, notes, ord)
  WHERE NOT EXISTS (SELECT 1 FROM public.food_items WHERE filter_id=v_sweets AND name=x.name);

END $$;


-- ============ Schema additions ============
ALTER TABLE public.food_items
  ADD COLUMN IF NOT EXISTS is_jain_friendly BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_dairy_free BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.food_filters
  ADD COLUMN IF NOT EXISTS order_number INT;

-- Number existing filters (sugar-spike series)
UPDATE public.food_filters SET order_number = display_order WHERE order_number IS NULL;

-- Mark existing dairy items as not dairy-free
UPDATE public.food_items SET is_dairy_free = false
  WHERE filter_id IN (SELECT id FROM public.food_filters WHERE slug = 'milk_and_milk_sugars')
  AND name IN ('Cow / Buffalo / A2 Milk');

-- Mark existing items that aren't Jain-friendly
UPDATE public.food_items SET is_jain_friendly = false
WHERE name IN ('Potato','Honey');
UPDATE public.food_items SET diet_type = 'veg' WHERE name = 'Cow / Buffalo / A2 Milk';

-- ============ F1: more staples ============
WITH f AS (SELECT id FROM public.food_filters WHERE slug = 'high_carb_staples')
INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_min, gi_max, gi_band, recommendation, notes, is_jain_friendly, is_dairy_free, display_order) VALUES
 ((SELECT id FROM f),'Basmati Rice','Long grain','vegan','raw',77,79,50,58,'medium','limit','Lower GI than polished rice when aged and cooked al dente.',true,true,14),
 ((SELECT id FROM f),'Poha','Flattened rice','vegan','raw',76,78,62,75,'med_high','limit','GI rises with finer flattening.',true,true,15),
 ((SELECT id FROM f),'Quinoa',NULL,'vegan','raw',64,66,50,53,'low_med','moderate','Complete protein; one of the better grain choices.',true,true,16),
 ((SELECT id FROM f),'Oats','Rolled','vegan','raw',66,68,55,58,'medium','limit','Instant oats are higher GI; prefer steel-cut.',true,true,17),
 ((SELECT id FROM f),'Sorghum','Jowar','vegan','raw',72,75,60,68,'medium','limit','Gluten-free; moderate GI.',true,true,18),
 ((SELECT id FROM f),'Amaranth','Rajgira','vegan','raw',65,67,40,55,'low_med','moderate','High protein, lower GI millet alternative.',true,true,19),
 ((SELECT id FROM f),'Buckwheat','Kuttu','vegan','raw',71,73,45,55,'low_med','moderate','Gluten-free pseudo-grain; good for fasting.',true,true,20),
 ((SELECT id FROM f),'Sweet Potato','Boiled','vegan','raw',20,22,44,61,'medium','limit','Lower GI than regular potato; fibre + beta-carotene.',false,true,21),
 ((SELECT id FROM f),'Yam','Suran','vegan','raw',27,30,35,55,'low_med','limit','Root vegetable; not Jain-friendly.',false,true,22),
 ((SELECT id FROM f),'Tapioca','Sabudana','vegan','raw',83,87,67,85,'high','avoid','Almost pure starch; rapid glucose spike.',true,true,23),
 ((SELECT id FROM f),'Semolina','Sooji / Rava','vegan','raw',72,75,60,70,'med_high','limit','Refined wheat; quicker spike than whole wheat.',true,true,24),
 ((SELECT id FROM f),'Vermicelli','Sevai','vegan','raw',77,80,58,65,'medium','limit','Made from maida or whole wheat.',true,true,25),
 ((SELECT id FROM f),'Cornflakes',NULL,'vegan','raw',82,84,80,85,'high','avoid','Highly processed cereal; large glucose spike.',true,true,26),
 ((SELECT id FROM f),'Pasta','Durum wheat','vegan','raw',71,74,42,55,'low_med','limit','Lower GI when cooked al dente.',true,true,27),
 ((SELECT id FROM f),'White Bread',NULL,'vegan','raw',49,52,70,85,'high','avoid','Refined flour, rapid glucose spike.',true,true,28),
 ((SELECT id FROM f),'Whole Wheat Bread',NULL,'vegan','raw',43,46,55,70,'medium','limit','Better than white bread but still moderate–high GI.',true,true,29),
 ((SELECT id FROM f),'Couscous','Refined wheat','vegan','raw',72,75,61,69,'medium','limit','Refined wheat granules; moderate GI.',true,true,30);

-- ============ F2: more sweeteners ============
WITH f AS (SELECT id FROM public.food_filters WHERE slug = 'sweets_and_sweeteners')
INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_min, gi_max, gi_band, recommendation, notes, is_jain_friendly, is_dairy_free, display_order) VALUES
 ((SELECT id FROM f),'Coconut Sugar',NULL,'vegan','raw',92,94,50,55,'medium','limit','Slightly lower GI than table sugar; trace minerals.',true,true,7),
 ((SELECT id FROM f),'Date Sugar',NULL,'vegan','raw',75,80,45,50,'low_med','limit','Whole-food sugar; some fibre retained.',true,true,8),
 ((SELECT id FROM f),'Agave Nectar',NULL,'vegan','raw',76,78,15,30,'low','limit','Very high fructose — low GI but burdens the liver.',true,true,9),
 ((SELECT id FROM f),'Molasses',NULL,'vegan','raw',74,76,55,60,'medium','limit','Strong flavour; rich in iron and minerals.',true,true,10),
 ((SELECT id FROM f),'Stevia',NULL,'vegan','raw',0,0,0,0,'low','moderate','Zero-calorie natural sweetener; no glucose impact.',true,true,11),
 ((SELECT id FROM f),'Monk Fruit',NULL,'vegan','raw',0,0,0,0,'low','moderate','Zero-calorie natural sweetener; preferred option.',true,true,12),
 ((SELECT id FROM f),'Erythritol',NULL,'vegan','raw',0,5,0,1,'low','moderate','Sugar alcohol; minimal blood sugar impact.',true,true,13),
 ((SELECT id FROM f),'Xylitol',NULL,'vegan','raw',60,65,7,13,'low','moderate','Sugar alcohol; very low GI but caloric.',true,true,14),
 ((SELECT id FROM f),'Sucralose','Splenda','vegan','raw',0,0,0,0,'low','avoid','Artificial sweetener; gut microbiome concerns.',true,true,15),
 ((SELECT id FROM f),'Aspartame','Equal','vegan','raw',0,0,0,0,'low','avoid','Artificial sweetener; better avoided.',true,true,16);

-- ============ F3: more pulses ============
WITH f AS (SELECT id FROM public.food_filters WHERE slug = 'pulses_and_legumes')
INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_min, gi_max, gi_band, recommendation, notes, health_benefits, is_jain_friendly, is_dairy_free, display_order) VALUES
 ((SELECT id FROM f),'Urad Dal','Black Gram (split)','vegan','raw',58,60,30,40,'low_med','limit','Used in dosa/idli batter; high protein.',ARRAY['Protein','Iron'],true,true,10),
 ((SELECT id FROM f),'Whole Moong','Green Gram','vegan','raw',60,63,30,38,'low_med','limit','Sprouts well; great for digestion.',ARRAY['Fibre','Protein'],true,true,11),
 ((SELECT id FROM f),'Whole Masoor','Brown Lentil','vegan','raw',60,63,25,30,'low','limit','Whole-grain version retains more fibre.',ARRAY['Fibre','Iron'],true,true,12),
 ((SELECT id FROM f),'Soybean',NULL,'vegan','raw',30,33,15,20,'low','moderate','Complete plant protein; lowest GI legume.',ARRAY['Complete protein','Isoflavones'],true,true,13),
 ((SELECT id FROM f),'Horsegram','Kulthi','vegan','raw',57,60,28,35,'low','limit','Traditional medicinal pulse; supports metabolism.',ARRAY['Antioxidants'],true,true,14),
 ((SELECT id FROM f),'Moth Bean','Matki','vegan','raw',60,63,28,35,'low','limit','High protein desert legume.',ARRAY['Protein'],true,true,15),
 ((SELECT id FROM f),'Sprouted Moong',NULL,'vegan','cooked',15,18,15,25,'low','moderate','Sprouting lowers carbs and GI further.',ARRAY['Enzymes','Vitamin C'],true,true,16);

-- ============ F4: more milks ============
WITH f AS (SELECT id FROM public.food_filters WHERE slug = 'milk_and_milk_sugars')
INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_min, gi_max, gi_band, recommendation, notes, health_benefits, extra, is_jain_friendly, is_dairy_free, display_order) VALUES
 ((SELECT id FROM f),'Goat Milk',NULL,'veg','per_100ml',4.3,4.5,42,48,'medium','limit','Easier to digest than cow milk for some.',ARRAY['Calcium','Protein'],'{"main_sugar":"Lactose","lactose_g_per_100ml_min":4.1,"lactose_g_per_100ml_max":4.5,"is_lactose_free":false}'::jsonb,true,false,7),
 ((SELECT id FROM f),'Camel Milk',NULL,'veg','per_100ml',4.2,4.5,40,45,'medium','limit','Lower lactose; insulin-like proteins.',ARRAY['Insulin-like proteins'],'{"main_sugar":"Lactose","lactose_g_per_100ml_min":4.0,"lactose_g_per_100ml_max":4.4,"is_lactose_free":false}'::jsonb,true,false,8),
 ((SELECT id FROM f),'Buttermilk','Chaas (unsweetened)','veg','per_100ml',4.0,5.0,30,40,'low_med','moderate','Probiotic; easier on digestion than milk.',ARRAY['Probiotics'],'{"main_sugar":"Lactose (reduced)","lactose_g_per_100ml_min":3.5,"lactose_g_per_100ml_max":4.5,"is_lactose_free":false,"fermented":true}'::jsonb,false,false,9),
 ((SELECT id FROM f),'Curd / Yogurt','Plain, unsweetened','veg','per_100g',3.5,4.5,11,30,'low','moderate','Fermentation lowers lactose and GI; not strictly Jain.',ARRAY['Probiotics','Calcium'],'{"main_sugar":"Lactose (reduced)","lactose_g_per_100ml_min":3.0,"lactose_g_per_100ml_max":4.5,"is_lactose_free":false,"fermented":true}'::jsonb,false,false,10),
 ((SELECT id FROM f),'Lactose-free Cow Milk',NULL,'veg','per_100ml',4.7,5.0,30,40,'low_med','moderate','Lactose enzymatically removed; lower GI.',ARRAY['Protein','Calcium'],'{"main_sugar":"Glucose + galactose","lactose_g_per_100ml_min":0,"lactose_g_per_100ml_max":0,"is_lactose_free":true}'::jsonb,true,false,11),
 ((SELECT id FROM f),'Cashew Milk','Unsweetened','vegan','per_100ml',1.0,2.0,20,30,'low','encourage','Low carb, creamy plant milk.',ARRAY['Low carb'],'{"main_sugar":"Negligible","lactose_g_per_100ml_min":0,"lactose_g_per_100ml_max":0,"is_lactose_free":true,"alternative":true}'::jsonb,true,true,12),
 ((SELECT id FROM f),'Rice Milk','Unsweetened','vegan','per_100ml',9.0,11.0,79,86,'high','avoid','Very high carb and high GI — worst plant milk choice.',ARRAY[]::TEXT[],'{"main_sugar":"Maltose","lactose_g_per_100ml_min":0,"lactose_g_per_100ml_max":0,"is_lactose_free":true,"alternative":true}'::jsonb,true,true,13),
 ((SELECT id FROM f),'Hemp Milk','Unsweetened','vegan','per_100ml',0.5,1.5,15,25,'low','encourage','Low carb; omega-3 fats.',ARRAY['Omega-3','Low carb'],'{"main_sugar":"Negligible","lactose_g_per_100ml_min":0,"lactose_g_per_100ml_max":0,"is_lactose_free":true,"alternative":true}'::jsonb,true,true,14);

-- ============ F5: more fruits ============
WITH f AS (SELECT id FROM public.food_filters WHERE slug = 'fruits_and_fruit_sugars')
INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_min, gi_max, gi_band, recommendation, notes, health_benefits, extra, is_jain_friendly, is_dairy_free, display_order) VALUES
 ((SELECT id FROM f),'Apple',NULL,'vegan','per_100g',13.8,13.8,36,40,'low','moderate','Lower GI fruit with pectin fibre.',ARRAY['Fibre','Vitamin C'],'{"sugar_group":"lower","total_sugars_g":10.4,"fructose_g":5.9,"glucose_g":2.4,"sucrose_g":2.1}'::jsonb,true,true,11),
 ((SELECT id FROM f),'Pear',NULL,'vegan','per_100g',15.2,15.2,38,42,'low','moderate','High fibre and moderate sweetness.',ARRAY['Fibre'],'{"sugar_group":"lower","total_sugars_g":9.8,"fructose_g":6.4,"glucose_g":2.6,"sucrose_g":0.8}'::jsonb,true,true,12),
 ((SELECT id FROM f),'Pineapple',NULL,'vegan','per_100g',13.1,13.1,59,66,'medium','limit','Bromelain enzymes; moderate–high GI.',ARRAY['Bromelain','Vitamin C'],'{"sugar_group":"higher","total_sugars_g":9.9,"fructose_g":2.1,"glucose_g":1.7,"sucrose_g":6.0}'::jsonb,true,true,13),
 ((SELECT id FROM f),'Pomegranate',NULL,'vegan','per_100g',18.7,18.7,53,53,'medium','limit','Antioxidant rich; moderate GI.',ARRAY['Antioxidants','Polyphenols'],'{"sugar_group":"higher","total_sugars_g":13.7,"fructose_g":6.4,"glucose_g":6.3,"sucrose_g":0.4}'::jsonb,true,true,14),
 ((SELECT id FROM f),'Cherry',NULL,'vegan','per_100g',16.0,16.0,22,22,'low','moderate','Low GI; melatonin and antioxidants.',ARRAY['Antioxidants','Melatonin'],'{"sugar_group":"lower","total_sugars_g":12.8,"fructose_g":5.4,"glucose_g":6.6,"sucrose_g":0.2}'::jsonb,true,true,15),
 ((SELECT id FROM f),'Peach',NULL,'vegan','per_100g',9.5,9.5,42,42,'low_med','moderate','Lower sugar stone fruit.',ARRAY['Vitamin A'],'{"sugar_group":"lower","total_sugars_g":8.4,"fructose_g":1.5,"glucose_g":2.0,"sucrose_g":4.8}'::jsonb,true,true,16),
 ((SELECT id FROM f),'Plum',NULL,'vegan','per_100g',11.4,11.4,40,40,'low','moderate','Low GI stone fruit.',ARRAY['Vitamin K'],'{"sugar_group":"lower","total_sugars_g":9.9,"fructose_g":3.1,"glucose_g":5.1,"sucrose_g":1.6}'::jsonb,true,true,17),
 ((SELECT id FROM f),'Litchi','Lychee','vegan','per_100g',16.5,16.5,50,57,'medium','limit','Sweet tropical fruit; eat in moderation.',ARRAY['Vitamin C'],'{"sugar_group":"higher","total_sugars_g":15.2,"fructose_g":3.2,"glucose_g":5.0,"sucrose_g":7.0}'::jsonb,true,true,18),
 ((SELECT id FROM f),'Custard Apple','Sitaphal','vegan','per_100g',23.7,23.7,54,54,'medium','avoid','Very high in sugar; avoid in reversal phase.',ARRAY['Vitamin C'],'{"sugar_group":"higher","total_sugars_g":19.0,"fructose_g":6.5,"glucose_g":5.8,"sucrose_g":6.7}'::jsonb,true,true,19),
 ((SELECT id FROM f),'Sapota','Chikoo','vegan','per_100g',19.9,19.9,55,55,'medium','avoid','Very sweet; high glycemic load.',ARRAY['Fibre'],'{"sugar_group":"higher","total_sugars_g":15.0,"fructose_g":4.8,"glucose_g":4.5,"sucrose_g":5.7}'::jsonb,true,true,20),
 ((SELECT id FROM f),'Jamun','Indian Blackberry','vegan','per_100g',14.0,14.0,25,30,'low','moderate','Traditionally used for blood sugar control.',ARRAY['Blood sugar support','Antioxidants'],'{"sugar_group":"lower","total_sugars_g":8.5,"fructose_g":3.2,"glucose_g":3.4,"sucrose_g":1.9}'::jsonb,true,true,21),
 ((SELECT id FROM f),'Dates','Khajur','vegan','per_100g',75,75,42,55,'low_med','avoid','Very high natural sugar — concentrated.',ARRAY['Potassium','Fibre'],'{"sugar_group":"higher","total_sugars_g":63.0,"fructose_g":31.0,"glucose_g":31.5,"sucrose_g":0.5}'::jsonb,true,true,22),
 ((SELECT id FROM f),'Raisins','Kishmish','vegan','per_100g',79,79,64,64,'high','avoid','Dried grapes — extreme sugar concentration.',ARRAY['Iron'],'{"sugar_group":"higher","total_sugars_g":59.0,"fructose_g":30.0,"glucose_g":27.8,"sucrose_g":1.2}'::jsonb,true,true,23),
 ((SELECT id FROM f),'Fig','Anjeer (fresh)','vegan','per_100g',19.2,19.2,51,61,'medium','limit','High sugar; fresh better than dried.',ARRAY['Fibre','Calcium'],'{"sugar_group":"higher","total_sugars_g":16.3,"fructose_g":7.1,"glucose_g":7.7,"sucrose_g":1.5}'::jsonb,true,true,24),
 ((SELECT id FROM f),'Avocado',NULL,'vegan','per_100g',8.5,8.5,15,15,'low','encourage','Very low sugar; rich in healthy fats and fibre.',ARRAY['Healthy fats','Fibre','Potassium'],'{"sugar_group":"lower","total_sugars_g":0.7,"fructose_g":0.1,"glucose_g":0.4,"sucrose_g":0.1}'::jsonb,true,true,25),
 ((SELECT id FROM f),'Lemon',NULL,'vegan','per_100g',9.3,9.3,20,20,'low','encourage','Negligible impact on blood sugar.',ARRAY['Vitamin C'],'{"sugar_group":"lower","total_sugars_g":2.5,"fructose_g":0.8,"glucose_g":1.0,"sucrose_g":0.6}'::jsonb,true,true,26);

-- Reset cumulative display_order so items sort by display_order within filter; (already set per insert)

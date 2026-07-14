
CREATE TABLE public.food_condition_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condition_key TEXT NOT NULL,
  action TEXT NOT NULL,
  name_pattern TEXT NOT NULL,
  filter_id UUID NULL REFERENCES public.food_filters(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.food_condition_rules TO anon, authenticated;
GRANT ALL ON public.food_condition_rules TO service_role;

ALTER TABLE public.food_condition_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read food condition rules"
  ON public.food_condition_rules FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage food condition rules"
  ON public.food_condition_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_food_condition_rules_key ON public.food_condition_rules(condition_key) WHERE is_active = true;

CREATE TRIGGER update_food_condition_rules_updated_at
  BEFORE UPDATE ON public.food_condition_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
DECLARE
  f_veg      UUID := 'edca2671-667e-4ab6-bb9a-91fe373d7dc4';
  f_fruit    UUID := 'a67cb44a-c179-4cf3-89e2-b3990f6b247e';
  f_nuts     UUID := 'cc1fc03e-3586-46cc-a19d-3a8abf06e595';
  f_lean     UUID := '0cc011c9-722a-432a-8115-c8ad313b4b5c';
  f_addon    UUID := 'ab64322b-4942-47c2-b4a0-d6763d84e794';
  f_sweets   UUID := 'e52064e3-02b7-417a-b988-e1a339aa9e76';
BEGIN
  INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, recommendation,
    carbs_min, carbs_max, gi_min, gi_max, gi_band, protein_g, fat_g, fiber_g, calories_kcal,
    health_benefits, is_jain_friendly, is_dairy_free, household_measure, household_grams, notes)
  VALUES
    (f_veg,   'Lettuce',           NULL,           'vegan', 'raw',      'encourage', 2, 3,   10, 20, 'low',    1.4,  0.2, 1.3, 15,  ARRAY['Very low carb','Hydrating'], true, true, '1 cup shredded', 50, NULL),
    (f_veg,   'Amaranth Leaves',   'Chaulai',      'vegan', 'cooked',   'encourage', 3, 5,   15, 30, 'low',    2.5,  0.3, 2.1, 23,  ARRAY['Rich in iron','High in vitamin C'], true, true, '1 cup cooked', 100, NULL),
    (f_veg,   'Tomato',            NULL,           'vegan', 'raw',      'encourage', 3, 5,   30, 38, 'low',    0.9,  0.2, 1.2, 18,  ARRAY['Vitamin C','Improves iron absorption'], true, true, '1 medium', 120, NULL),
    (f_veg,   'Beetroot',          NULL,           'vegan', 'cooked',   'limit',     8, 10,  55, 65, 'medium', 1.6,  0.2, 2.8, 43,  ARRAY['Nitrates','Beta cyanin'], false, true, '1/2 cup', 80, 'Limit in CKD (potassium)'),
    (f_addon, 'Coconut Water',     NULL,           'vegan', 'per_100ml','moderate',  3, 5,   50, 55, 'low_med',0.2,  0.0, 1.1, 19,  ARRAY['Electrolytes','Hydration'], true, true, '1 glass (200 ml)', 200, 'Limit in CKD (potassium)'),
    (f_addon, 'Coffee',            'Black, unsweetened','vegan','per_100ml','encourage', 0, 1, 0, 0, 'low',    0.1,  0.0, 0.0, 2,   ARRAY['Antioxidants','Protective for liver'], true, true, '1 cup (200 ml)', 200, NULL),
    (f_addon, 'Cocoa Powder',      'Unsweetened',  'vegan', 'raw',      'encourage', 5, 8,   20, 25, 'low',    20.0, 14.0, 33.0, 228, ARRAY['Magnesium','Flavonoids'], true, true, '1 tbsp', 6, NULL),
    (f_addon, 'Alcohol',           'Beer, wine, spirits','vegan','per_100ml','avoid', 3, 10, 60, 80, 'high',   0.5,  0.0, 0.0, 55,  ARRAY[]::text[], true, true, '1 serving', 30, 'Avoid in CKD, NAFLD, gout, PCOS'),
    (f_addon, 'Iodized Salt',      NULL,           'vegan', 'raw',      'moderate',  0, 0,   0, 0,  'low',     0.0,  0.0, 0.0, 0,   ARRAY['Iodine source'], true, true, '1 pinch', 1, 'Helpful in hypothyroidism at appropriate doses'),
    (f_lean,  'Liver',             'Organ meat',   'non_veg','cooked',  'avoid',     0, 4,   0, 0,  'low',     26.0, 4.0, 0.0, 175, ARRAY['Iron-rich (encourage in iron deficiency only)'], false, true, '80 g', 80, 'Avoid in CKD & gout (very high purine)'),
    (f_lean,  'Processed Meats',   'Sausage, salami, bacon','non_veg','cooked','avoid', 0, 4, 0, 0, 'low',    15.0, 25.0, 0.0, 300, ARRAY[]::text[], false, true, '2 slices', 60, 'High sodium, nitrates'),
    (f_lean,  'Anchovies',         NULL,           'non_veg','cooked',  'avoid',     0, 0,   0, 0,  'low',     20.0, 4.8, 0.0, 131, ARRAY[]::text[], false, true, '50 g', 50, 'Very high purine — avoid in gout / CKD'),
    (f_lean,  'Prawns / Shellfish',NULL,           'non_veg','cooked',  'limit',     0, 1,   0, 0,  'low',     24.0, 1.7, 0.0, 99,  ARRAY['Iodine'], false, true, '80 g', 80, 'Limit during gout flares'),
    (f_sweets,'Ice Cream',         NULL,           'veg',   'raw',      'avoid',    22, 26,  60, 70, 'high',   3.5,  10.0, 0.5, 200, ARRAY[]::text[], true, false, '1 scoop', 65, NULL),
    (f_sweets,'Bakery Products',   'Cakes, pastries, cookies','veg','raw','avoid',   45, 60,  70, 85, 'high',   5.0,  20.0, 1.0, 420, ARRAY[]::text[], true, false, '1 piece', 60, NULL),
    (f_sweets,'Sugar-Sweetened Beverages','Cola, soft drinks','vegan','per_100ml','avoid', 10,12, 63,70,'high', 0.0, 0.0, 0.0, 42, ARRAY[]::text[], true, true, '1 can (330 ml)', 330, NULL),
    (f_nuts,  'Garden Cress Seeds','Halim / Aliv', 'vegan', 'raw',      'encourage', 3, 5,   15, 25, 'low',    22.0, 21.0, 8.0, 454, ARRAY['Iron-rich','Folate'], true, true, '1 tsp', 5, NULL),
    (f_fruit, 'Amla',              'Indian Gooseberry','vegan','raw',   'encourage', 6, 10,  25, 35, 'low',    0.9,  0.6, 4.3, 44,  ARRAY['Vitamin C','Improves iron absorption'], true, true, '1 medium', 60, NULL),
    (f_fruit, 'Cherries (tart)',   NULL,           'vegan', 'raw',      'encourage', 12, 16, 22, 32, 'low',    1.0,  0.3, 2.1, 63,  ARRAY['Anti-inflammatory','Helps lower uric acid'], true, true, '1 cup', 140, NULL)
  ON CONFLICT DO NOTHING;
END $$;

INSERT INTO public.food_condition_rules (condition_key, action, name_pattern, reason, priority)
VALUES
  ('hypothyroid', 'avoid', 'processed meats',   'Ultra-processed foods worsen thyroid inflammation', 90),
  ('hypothyroid', 'avoid', 'ice cream',         'Sugar spikes worsen thyroid metabolism', 90),
  ('hypothyroid', 'avoid', 'bakery products',   'Refined flour & sugar aggravate hypothyroid weight gain', 90),
  ('hypothyroid', 'avoid', 'sugar-sweetened',   'Sugary drinks worsen metabolic load', 90),
  ('hypothyroid', 'avoid', 'alcohol',           'Alcohol interferes with thyroid hormones', 90),
  ('hypothyroid', 'limit', 'soy',               'Large amounts of soy can interfere with thyroid medication', 80),
  ('hypothyroid', 'limit', 'tofu',              'Limit large portions — soy isoflavones affect thyroid', 80),
  ('hypothyroid', 'limit', 'millet',            'Millets as a staple can be goitrogenic', 80),
  ('hypothyroid', 'limit', 'cabbage',           'Cook well and moderate portions (goitrogenic when raw)', 70),
  ('hypothyroid', 'limit', 'cauliflower',       'Cook well and moderate portions (goitrogenic when raw)', 70),
  ('hypothyroid', 'limit', 'broccoli',          'Cook well and moderate portions (goitrogenic when raw)', 70),
  ('hypothyroid', 'limit', 'kale',              'Best cooked — raw kale is goitrogenic', 70),
  ('hypothyroid', 'encourage', 'brazil nut',    'Selenium supports T4 → T3 conversion', 60),
  ('hypothyroid', 'encourage', 'eggs',          'Iodine, selenium & tyrosine', 60),
  ('hypothyroid', 'encourage', 'pumpkin seed',  'Zinc supports thyroid hormone synthesis', 60),
  ('hypothyroid', 'encourage', 'iodized salt',  'Iodine source (use appropriately)', 60),

  ('hyperthyroid', 'avoid', 'iodized salt',     'Excess iodine can worsen hyperthyroid', 90),
  ('hyperthyroid', 'limit', 'prawns',           'High iodine — limit in hyperthyroid', 80),
  ('hyperthyroid', 'limit', 'coffee',           'Caffeine can worsen tachycardia', 80),
  ('hyperthyroid', 'avoid', 'alcohol',          'Aggravates hyperthyroid symptoms', 90),
  ('hyperthyroid', 'encourage', 'cabbage',      'Cruciferous vegetables can help', 60),
  ('hyperthyroid', 'encourage', 'broccoli',     'Cruciferous vegetables can help', 60),
  ('hyperthyroid', 'encourage', 'cauliflower',  'Cruciferous vegetables can help', 60),

  ('pcos', 'avoid', 'sugar-sweetened',          'Spikes insulin — the primary driver of PCOS', 90),
  ('pcos', 'avoid', 'bakery products',          'Refined flour spikes insulin', 90),
  ('pcos', 'avoid', 'ice cream',                'Sugar + dairy worsen PCOS', 90),
  ('pcos', 'avoid', 'white bread',              'Refined flour worsens insulin resistance', 85),
  ('pcos', 'avoid', 'white rice',               'Large portions spike insulin', 80),
  ('pcos', 'avoid', 'maida',                    'Refined flour worsens insulin resistance', 90),
  ('pcos', 'avoid', 'processed meats',          'Ultra-processed foods worsen inflammation', 85),
  ('pcos', 'avoid', 'alcohol',                  'Alcohol worsens liver & hormonal load', 85),
  ('pcos', 'limit', 'potato',                   'High GI — limit portions', 70),
  ('pcos', 'limit', 'cornflakes',               'Refined cereal spikes insulin', 80),
  ('pcos', 'encourage', 'cocoa',                'Magnesium supports insulin sensitivity', 60),
  ('pcos', 'encourage', 'flax seed',            'Omega-3 supports hormone balance', 60),
  ('pcos', 'encourage', 'chia seed',            'Omega-3 & fibre', 60),
  ('pcos', 'encourage', 'pumpkin seed',         'Zinc & magnesium for hormone balance', 60),

  ('ckd', 'avoid', 'processed meats',           'Very high sodium load — harmful for kidneys', 95),
  ('ckd', 'avoid', 'liver',                     'Organ meat — high phosphorus & purines', 95),
  ('ckd', 'avoid', 'anchovies',                 'Very high purine load', 90),
  ('ckd', 'avoid', 'sugar-sweetened',           'Sugary drinks worsen kidney load', 90),
  ('ckd', 'avoid', 'alcohol',                   'Adds toxic load on kidneys', 95),
  ('ckd', 'avoid', 'ice cream',                 'High phosphate additives', 80),
  ('ckd', 'limit', 'banana',                    'High potassium — limit portions', 90),
  ('ckd', 'limit', 'orange',                    'High potassium', 85),
  ('ckd', 'limit', 'coconut water',             'High potassium — limit in CKD', 90),
  ('ckd', 'limit', 'potato',                    'High potassium — soak & limit', 85),
  ('ckd', 'limit', 'spinach',                   'High potassium — small portions', 85),
  ('ckd', 'limit', 'beetroot',                  'High potassium & oxalate', 85),
  ('ckd', 'limit', 'raisins',                   'Dried fruit — concentrated potassium', 85),
  ('ckd', 'limit', 'dates',                     'Dried fruit — concentrated potassium & sugar', 85),
  ('ckd', 'encourage', 'cabbage',               'Low-potassium safe vegetable', 60),
  ('ckd', 'encourage', 'cauliflower',           'Low-potassium safe vegetable', 60),
  ('ckd', 'encourage', 'bottle gourd',          'Kidney-friendly low-potassium vegetable', 60),
  ('ckd', 'encourage', 'apple',                 'Kidney-friendly fruit in small portions', 60),

  ('uric_acid', 'avoid', 'liver',               'Organ meat — extremely high purine', 95),
  ('uric_acid', 'avoid', 'anchovies',           'Very high purine', 95),
  ('uric_acid', 'avoid', 'sardines',            'Very high purine — avoid during flares', 90),
  ('uric_acid', 'avoid', 'alcohol',             'Beer & spirits sharply raise uric acid', 95),
  ('uric_acid', 'avoid', 'sugar-sweetened',     'Fructose raises uric acid', 90),
  ('uric_acid', 'avoid', 'processed meats',     'High purine + additives', 85),
  ('uric_acid', 'limit', 'prawns',              'Shellfish — limit especially during flares', 85),
  ('uric_acid', 'limit', 'mutton',              'Red meat — moderate portions', 80),
  ('uric_acid', 'limit', 'mackerel',            'Higher-purine fish — moderate', 75),
  ('uric_acid', 'encourage', 'cherries',        'Shown to lower uric acid', 60),
  ('uric_acid', 'encourage', 'amla',            'Vitamin C helps lower uric acid', 60),
  ('uric_acid', 'encourage', 'lemon',           'Alkalising, helps uric acid clearance', 60),
  ('uric_acid', 'encourage', 'coffee',          'Associated with lower uric acid', 60),

  ('fatty_liver', 'avoid', 'sugar-sweetened',   'Fructose is the main driver of NAFLD', 95),
  ('fatty_liver', 'avoid', 'alcohol',           'Direct hepatotoxin', 95),
  ('fatty_liver', 'avoid', 'bakery products',   'Refined flour + sugar', 90),
  ('fatty_liver', 'avoid', 'ice cream',         'Sugar & saturated fat load', 85),
  ('fatty_liver', 'avoid', 'processed meats',   'Trans fats & preservatives', 85),
  ('fatty_liver', 'avoid', 'maida',             'Refined flour spikes de-novo lipogenesis', 90),
  ('fatty_liver', 'avoid', 'white bread',       'Refined flour', 85),
  ('fatty_liver', 'limit', 'white rice',        'Large portions worsen liver fat', 75),
  ('fatty_liver', 'limit', 'potato',            'Limit frequent portions', 70),
  ('fatty_liver', 'encourage', 'coffee',        'Protective against liver fibrosis', 60),
  ('fatty_liver', 'encourage', 'green tea',     'Catechins support liver health', 60),
  ('fatty_liver', 'encourage', 'walnut',        'Omega-3 for liver', 60),
  ('fatty_liver', 'encourage', 'flax seed',     'Omega-3 for liver', 60),
  ('fatty_liver', 'encourage', 'amla',          'Hepatoprotective', 60),

  ('iron_deficiency', 'encourage', 'eggs',          'Egg yolks contain heme iron', 70),
  ('iron_deficiency', 'encourage', 'spinach',       'Rich in non-heme iron', 70),
  ('iron_deficiency', 'encourage', 'fenugreek leaves','Methi is iron-rich', 70),
  ('iron_deficiency', 'encourage', 'amaranth leaves','Chaulai is iron-rich', 70),
  ('iron_deficiency', 'encourage', 'sesame seed',   'Sesame seeds are rich in iron', 70),
  ('iron_deficiency', 'encourage', 'pumpkin seed',  'Pumpkin seeds are rich in iron', 70),
  ('iron_deficiency', 'encourage', 'garden cress',  'Halim is one of the richest plant iron sources', 90),
  ('iron_deficiency', 'encourage', 'liver',         'Organ meat — richest heme iron (if appropriate)', 70),
  ('iron_deficiency', 'encourage', 'amla',          'Vitamin C boosts iron absorption', 60),
  ('iron_deficiency', 'encourage', 'lemon',         'Vitamin C boosts iron absorption', 60),
  ('iron_deficiency', 'encourage', 'guava',         'Vitamin C boosts iron absorption', 60),
  ('iron_deficiency', 'encourage', 'capsicum',      'Vitamin C boosts iron absorption', 60),
  ('iron_deficiency', 'encourage', 'tomato',        'Vitamin C boosts iron absorption', 60),
  ('iron_deficiency', 'limit',     'coffee',        'Tannins reduce iron absorption — separate from iron-rich meals', 70);

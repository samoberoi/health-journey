
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.food_category_slug AS ENUM ('sugar_spike', 'metabolic_essential', 'power_addon');
CREATE TYPE public.food_recommendation AS ENUM ('avoid', 'limit', 'moderate', 'encourage');
CREATE TYPE public.food_gi_band AS ENUM ('low', 'low_med', 'medium', 'med_high', 'high');
CREATE TYPE public.food_diet_type AS ENUM ('veg', 'vegan', 'non_veg', 'jain');
CREATE TYPE public.food_serving_basis AS ENUM ('per_100g', 'per_100ml', 'cooked', 'raw');

-- =========================================================
-- food_categories
-- =========================================================
CREATE TABLE public.food_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug public.food_category_slug NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  severity_default public.food_recommendation NOT NULL DEFAULT 'moderate',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.food_categories TO authenticated;
GRANT ALL ON public.food_categories TO service_role;
ALTER TABLE public.food_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed can read food categories" ON public.food_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage food categories" ON public.food_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_food_categories_updated BEFORE UPDATE ON public.food_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =========================================================
-- food_filters
-- =========================================================
CREATE TABLE public.food_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.food_categories(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  display_order INT NOT NULL DEFAULT 0,
  key_takeaways TEXT[] NOT NULL DEFAULT '{}',
  cautionary_note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.food_filters TO authenticated;
GRANT ALL ON public.food_filters TO service_role;
ALTER TABLE public.food_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed can read food filters" ON public.food_filters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage food filters" ON public.food_filters FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_food_filters_updated BEFORE UPDATE ON public.food_filters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX idx_food_filters_category ON public.food_filters(category_id, display_order);

-- =========================================================
-- food_items
-- =========================================================
CREATE TABLE public.food_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filter_id UUID NOT NULL REFERENCES public.food_filters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  alt_name TEXT,
  image_url TEXT,
  diet_type public.food_diet_type NOT NULL DEFAULT 'veg',
  serving_basis public.food_serving_basis NOT NULL DEFAULT 'per_100g',
  carbs_min NUMERIC,
  carbs_max NUMERIC,
  gi_min INT,
  gi_max INT,
  gi_band public.food_gi_band,
  protein_g NUMERIC,
  fat_g NUMERIC,
  fiber_g NUMERIC,
  calories_kcal NUMERIC,
  recommendation public.food_recommendation NOT NULL DEFAULT 'moderate',
  health_benefits TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.food_items TO authenticated;
GRANT ALL ON public.food_items TO service_role;
ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed can read food items" ON public.food_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage food items" ON public.food_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_food_items_updated BEFORE UPDATE ON public.food_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX idx_food_items_filter ON public.food_items(filter_id, display_order);

-- =========================================================
-- food_item_tags + links
-- =========================================================
CREATE TABLE public.food_item_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.food_item_tags TO authenticated;
GRANT ALL ON public.food_item_tags TO service_role;
ALTER TABLE public.food_item_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed can read food tags" ON public.food_item_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage food tags" ON public.food_item_tags FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.food_item_tag_links (
  food_item_id UUID NOT NULL REFERENCES public.food_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.food_item_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (food_item_id, tag_id)
);
GRANT SELECT ON public.food_item_tag_links TO authenticated;
GRANT ALL ON public.food_item_tag_links TO service_role;
ALTER TABLE public.food_item_tag_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed can read food tag links" ON public.food_item_tag_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage food tag links" ON public.food_item_tag_links FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- SEED: categories
-- =========================================================
INSERT INTO public.food_categories (slug, name, description, severity_default, display_order) VALUES
  ('sugar_spike', 'Sugar Spike Triggers', 'Foods that spike blood glucose. Avoid, limit or reduce during the reversal phase.', 'avoid', 1),
  ('metabolic_essential', 'Metabolic Essentials', 'Core nutrient-dense foods that drive metabolic reversal — lean protein, healthy fats, fibrous vegetables.', 'encourage', 2),
  ('power_addon', 'Power Add-ons', 'Optional boosters: nuts, seeds, spices, fermented foods and beverages that amplify results.', 'encourage', 3);

-- =========================================================
-- SEED: filters 1–5 (Sugar Spike Triggers)
-- =========================================================
WITH cat AS (SELECT id FROM public.food_categories WHERE slug = 'sugar_spike')
INSERT INTO public.food_filters (category_id, slug, name, description, icon, display_order, key_takeaways, cautionary_note) VALUES
  ((SELECT id FROM cat), 'high_carb_staples', 'High-Carb Staple Foods', 'Rice, wheat, millets and potato — carb content and glycemic index.', 'Wheat', 1,
    ARRAY['Lowest GI staples: barnyard millet, little millet, kodo millet','Moderate: brown rice, whole wheat, foxtail millet','Highest GI: white rice, maida, hot potatoes, ragi (in flour form)'],
    'Advisable to avoid all carb-heavy staples in the reversal phase; can moderate intake with coach guidance.'),
  ((SELECT id FROM cat), 'sweets_and_sweeteners', 'Sweets & Sweet Products', 'Refined sugars, natural sweeteners and syrups.', 'Candy', 2,
    ARRAY['All sweeteners are high in carbs and can raise blood sugar','Natural sweeteners (jaggery, honey, maple) still raise glucose — use sparingly','Avoid sucralose and aspartame; stevia and monk fruit are better choices'],
    'Preferably avoid all sweeteners during reversal phase.'),
  ((SELECT id FROM cat), 'pulses_and_legumes', 'Pulses & Legumes', 'Dals, chana, rajma, lobia — high in carbs despite low–medium GI.', 'Bean', 3,
    ARRAY['All pulses are high in carbs and can raise blood sugar despite low/moderate GI','Nutrient-dense and rich in fiber and protein','Take coach guidance on portion size during reversal'],
    'Preferably avoided during the reversal phase.'),
  ((SELECT id FROM cat), 'milk_and_milk_sugars', 'Milk & Milk Sugars', 'Dairy and plant milks ranked by lactose and total carbs.', 'Milk', 4,
    ARRAY['Avoiding lactose helps prevent blood sugar spikes','Almond, coconut and pea milk are negligible-carb alternatives','Tolerance varies per person — take coach guidance'],
    'Choose lactose-free / low-carb options during reversal phase.'),
  ((SELECT id FROM cat), 'fruits_and_fruit_sugars', 'Fruits & Fruit Sugars', 'Natural sugars (fructose / glucose / sucrose), carbs and GI of common fruits.', 'Apple', 5,
    ARRAY['Fruits contain fructose, glucose and sucrose — excess raises blood sugar','Higher-sugar fruits cause quicker spikes','Guava, strawberry, blueberry are the safest in moderation'],
    'Preferably avoid high-sugar fruits during reversal phase. Low-sugar fruits in moderation with coach guidance.');

-- =========================================================
-- SEED: food_items
-- =========================================================
-- F1 High-Carb Staple Foods
WITH f AS (SELECT id FROM public.food_filters WHERE slug = 'high_carb_staples')
INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_min, gi_max, gi_band, recommendation, notes, display_order) VALUES
  ((SELECT id FROM f), 'White Rice', 'Polished', 'vegan', 'raw', 78, 80, 70, 90, 'high', 'avoid', 'Rapid glucose spike; depends on variety (e.g. basmati lower).', 1),
  ((SELECT id FROM f), 'Brown Rice', NULL, 'vegan', 'raw', 76, 78, 50, 65, 'medium', 'limit', 'More fiber → slower absorption than white rice.', 2),
  ((SELECT id FROM f), 'Low-starch Rice', 'Drained / washed cooked rice', 'vegan', 'cooked', 20, 30, 50, 70, 'med_high', 'limit', 'Starch reduced by cooking method, not eliminated.', 3),
  ((SELECT id FROM f), 'Wheat', 'Whole grain', 'vegan', 'raw', 70, 72, 60, 70, 'med_high', 'limit', 'Used for atta; moderate GI.', 4),
  ((SELECT id FROM f), 'Maida', 'Refined wheat flour', 'vegan', 'raw', 74, 76, 70, 85, 'high', 'avoid', 'Low fiber → faster glucose spike.', 5),
  ((SELECT id FROM f), 'Kodo Millet', NULL, 'vegan', 'raw', 65, 66, 50, 60, 'low_med', 'moderate', 'Better for glycemic control.', 6),
  ((SELECT id FROM f), 'Foxtail Millet', NULL, 'vegan', 'raw', 60, 65, 50, 60, 'low_med', 'moderate', 'Slower digestion.', 7),
  ((SELECT id FROM f), 'Pearl Millet', 'Bajra', 'vegan', 'raw', 65, 67, 55, 70, 'medium', 'limit', 'Nutrient-dense but GI varies.', 8),
  ((SELECT id FROM f), 'Finger Millet', 'Ragi', 'vegan', 'raw', 70, 72, 65, 80, 'med_high', 'limit', 'Can spike glucose when finely ground.', 9),
  ((SELECT id FROM f), 'Little Millet', NULL, 'vegan', 'raw', 65, 67, 50, 55, 'low', 'moderate', 'One of the lower GI millets.', 10),
  ((SELECT id FROM f), 'Barnyard Millet', NULL, 'vegan', 'raw', 65, 68, 40, 50, 'low', 'moderate', 'Good for diabetics.', 11),
  ((SELECT id FROM f), 'Potato', 'Boiled', 'vegan', 'raw', 17, 20, 65, 90, 'med_high', 'limit', 'GI varies a lot by cooking method.', 12),
  ((SELECT id FROM f), 'Potato', 'Cooled after cooking', 'vegan', 'cooked', 17, 20, 50, 65, 'medium', 'limit', 'Resistant starch forms → lower GI.', 13);

-- F2 Sweets & Sweet Products
WITH f AS (SELECT id FROM public.food_filters WHERE slug = 'sweets_and_sweeteners')
INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_min, gi_max, gi_band, recommendation, notes, health_benefits, display_order) VALUES
  ((SELECT id FROM f), 'Table Sugar', 'Sucrose', 'vegan', 'raw', 99, 100, 65, 65, 'high', 'avoid', 'Refined white sugar. Causes quick spike in blood glucose.', ARRAY[]::TEXT[], 1),
  ((SELECT id FROM f), 'Brown Sugar', NULL, 'vegan', 'raw', 98, 99, 64, 64, 'high', 'avoid', 'Contains molasses (trace minerals); GI similar to table sugar.', ARRAY[]::TEXT[], 2),
  ((SELECT id FROM f), 'Jaggery', 'Gur', 'vegan', 'raw', 85, 90, 55, 65, 'medium', 'limit', 'Unrefined sugar from sugarcane/palm. Contains minerals; GI lower than sugar.', ARRAY['Trace minerals'], 3),
  ((SELECT id FROM f), 'Honey', NULL, 'veg', 'raw', 80, 82, 50, 58, 'medium', 'limit', 'Natural sweetener with antioxidants. GI varies by floral origin.', ARRAY['Antioxidants'], 4),
  ((SELECT id FROM f), 'Maple Syrup', NULL, 'vegan', 'raw', 66, 68, 54, 65, 'medium', 'limit', 'Contains manganese and zinc. Moderate GI.', ARRAY['Manganese','Zinc'], 5),
  ((SELECT id FROM f), 'High Fructose Corn Syrup', 'HFCS', 'vegan', 'raw', 75, 78, 55, 65, 'med_high', 'avoid', 'Common in processed foods & drinks. High fructose may harm metabolic health.', ARRAY[]::TEXT[], 6);

-- F3 Pulses & Legumes
WITH f AS (SELECT id FROM public.food_filters WHERE slug = 'pulses_and_legumes')
INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_min, gi_max, gi_band, recommendation, notes, health_benefits, display_order) VALUES
  ((SELECT id FROM f), 'Masoor Dal', 'Red Lentil', 'vegan', 'raw', 58, 60, 25, 30, 'low', 'limit', 'Cooks quickly; easy to digest.', ARRAY['Protein','Iron'], 1),
  ((SELECT id FROM f), 'Moong Dal', 'Yellow/Green Lentil', 'vegan', 'raw', 57, 59, 28, 32, 'low', 'limit', 'Easier to digest; good for gut health.', ARRAY['Gut health'], 2),
  ((SELECT id FROM f), 'Arhar Dal', 'Toor Dal / Pigeon Pea', 'vegan', 'raw', 60, 62, 30, 35, 'low_med', 'limit', 'High in protein and fiber; moderate GI.', ARRAY['Protein','Fiber'], 3),
  ((SELECT id FROM f), 'Chana Dal', 'Bengal Gram Dal', 'vegan', 'raw', 58, 60, 30, 40, 'low_med', 'limit', 'Rich in fiber; supports satiety.', ARRAY['Fiber','Satiety'], 4),
  ((SELECT id FROM f), 'Matar Dal', 'Split Peas', 'vegan', 'raw', 56, 58, 30, 35, 'low_med', 'limit', 'Good source of plant protein; rich in vitamins and minerals.', ARRAY['Plant protein','Vitamins'], 5),
  ((SELECT id FROM f), 'Kabuli Chana', 'Chickpeas', 'vegan', 'raw', 53, 57, 28, 36, 'low_med', 'limit', 'High fiber; slower digestion; supports heart health.', ARRAY['Fiber','Heart health'], 6),
  ((SELECT id FROM f), 'Kala Chana', 'Black Chickpeas', 'vegan', 'raw', 54, 56, 30, 40, 'low_med', 'limit', 'More fiber than kabuli chana; helps blood sugar control.', ARRAY['Fiber','Blood sugar'], 7),
  ((SELECT id FROM f), 'Rajma', 'Kidney Beans', 'vegan', 'raw', 55, 57, 24, 29, 'low', 'limit', 'High in fiber and protein; promotes fullness.', ARRAY['Fiber','Protein'], 8),
  ((SELECT id FROM f), 'Lobia', 'Black-eyed Peas', 'vegan', 'raw', 54, 56, 25, 30, 'low', 'limit', 'Good source of fiber and folate; supports digestion.', ARRAY['Fiber','Folate'], 9);

-- F4 Milk & Milk Sugars
WITH f AS (SELECT id FROM public.food_filters WHERE slug = 'milk_and_milk_sugars')
INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_min, gi_max, gi_band, recommendation, notes, health_benefits, extra, display_order) VALUES
  ((SELECT id FROM f), 'Cow / Buffalo / A2 Milk', 'Whole / Toned / Skimmed', 'veg', 'per_100ml', 4.7, 5.0, 45, 50, 'medium', 'limit', 'Natural source of protein, calcium & nutrients. Contains lactose which can raise blood sugar.', ARRAY['Protein','Calcium'], '{"main_sugar":"Lactose","lactose_g_per_100ml_min":4.7,"lactose_g_per_100ml_max":4.9,"is_lactose_free":false}'::jsonb, 1),
  ((SELECT id FROM f), 'Oats Milk', 'Unsweetened', 'vegan', 'per_100ml', 6.0, 7.0, 45, 55, 'medium', 'limit', 'Naturally lactose free; higher carbs from oats.', ARRAY['Lactose free'], '{"main_sugar":"Maltose + added carb (oats)","lactose_g_per_100ml_min":0,"lactose_g_per_100ml_max":0,"is_lactose_free":true}'::jsonb, 2),
  ((SELECT id FROM f), 'Soy Milk', 'Unsweetened', 'vegan', 'per_100ml', 2.0, 3.0, 30, 35, 'low', 'moderate', 'Naturally lactose free; lower carbs, good plant protein source.', ARRAY['Lactose free','Plant protein'], '{"main_sugar":"Sucrose / oligosaccharides","lactose_g_per_100ml_min":0,"lactose_g_per_100ml_max":0,"is_lactose_free":true}'::jsonb, 3),
  ((SELECT id FROM f), 'Almond Milk', 'Unsweetened', 'vegan', 'per_100ml', 0.2, 0.6, 15, 25, 'low', 'encourage', 'Very low in carbs; rich in Vitamin E.', ARRAY['Vitamin E','Low carb'], '{"main_sugar":"Negligible","lactose_g_per_100ml_min":0,"lactose_g_per_100ml_max":0,"is_lactose_free":true,"alternative":true}'::jsonb, 4),
  ((SELECT id FROM f), 'Coconut Milk', 'Unsweetened', 'vegan', 'per_100ml', 0.5, 1.0, 10, 20, 'low', 'encourage', 'Very low in carbs; good fats, calorie dense.', ARRAY['Healthy fats','Low carb'], '{"main_sugar":"Negligible","lactose_g_per_100ml_min":0,"lactose_g_per_100ml_max":0,"is_lactose_free":true,"alternative":true}'::jsonb, 5),
  ((SELECT id FROM f), 'Pea Milk', 'Unsweetened', 'vegan', 'per_100ml', 0.5, 1.0, 15, 25, 'low', 'encourage', 'Low in carbs; good plant protein source.', ARRAY['Plant protein','Low carb'], '{"main_sugar":"Negligible","lactose_g_per_100ml_min":0,"lactose_g_per_100ml_max":0,"is_lactose_free":true,"alternative":true}'::jsonb, 6);

-- F5 Fruits & Fruit Sugars
WITH f AS (SELECT id FROM public.food_filters WHERE slug = 'fruits_and_fruit_sugars')
INSERT INTO public.food_items (filter_id, name, alt_name, diet_type, serving_basis, carbs_min, carbs_max, gi_min, gi_max, gi_band, recommendation, notes, health_benefits, extra, display_order) VALUES
  ((SELECT id FROM f), 'Mango', NULL, 'vegan', 'per_100g', 14.8, 14.8, 51, 51, 'medium', 'limit', 'High in natural sugars; best consumed in moderation.', ARRAY['Vitamin A','Vitamin C'], '{"sugar_group":"higher","total_sugars_g":13.7,"fructose_g":7.4,"glucose_g":6.3,"sucrose_g":0}'::jsonb, 1),
  ((SELECT id FROM f), 'Banana', NULL, 'vegan', 'per_100g', 22.8, 22.8, 51, 51, 'medium', 'limit', 'Higher carbs & sugars; riper bananas = higher sugar.', ARRAY['Potassium'], '{"sugar_group":"higher","total_sugars_g":12.2,"fructose_g":5.0,"glucose_g":4.7,"sucrose_g":2.5}'::jsonb, 2),
  ((SELECT id FROM f), 'Orange', NULL, 'vegan', 'per_100g', 11.8, 11.8, 43, 43, 'low_med', 'limit', 'Natural sugars with vitamin C. Whole fruit better than juice.', ARRAY['Vitamin C'], '{"sugar_group":"higher","total_sugars_g":8.4,"fructose_g":2.6,"glucose_g":2.4,"sucrose_g":3.4}'::jsonb, 3),
  ((SELECT id FROM f), 'Melons', 'Watermelon / Musk Melon', 'vegan', 'per_100g', 7.6, 7.6, 72, 72, 'high', 'avoid', 'High GI (watermelon). Eat in smaller portions.', ARRAY['Hydration'], '{"sugar_group":"higher","total_sugars_g":6.2,"fructose_g":3.1,"glucose_g":3.1,"sucrose_g":0}'::jsonb, 4),
  ((SELECT id FROM f), 'Papaya', NULL, 'vegan', 'per_100g', 10.8, 10.8, 59, 59, 'medium', 'limit', 'Good for digestion; natural sugars present.', ARRAY['Digestive enzymes','Vitamin C'], '{"sugar_group":"higher","total_sugars_g":7.8,"fructose_g":4.1,"glucose_g":3.2,"sucrose_g":0.5}'::jsonb, 5),
  ((SELECT id FROM f), 'Kiwi', NULL, 'vegan', 'per_100g', 14.7, 14.7, 52, 52, 'medium', 'limit', 'Nutrient dense; moderate natural sugars.', ARRAY['Vitamin C','Fiber'], '{"sugar_group":"higher","total_sugars_g":8.9,"fructose_g":4.6,"glucose_g":4.2,"sucrose_g":0.1}'::jsonb, 6),
  ((SELECT id FROM f), 'Grapes', NULL, 'vegan', 'per_100g', 16.2, 16.2, 46, 46, 'low_med', 'limit', 'Very high in natural sugars; small portions recommended.', ARRAY['Antioxidants'], '{"sugar_group":"higher","total_sugars_g":15.5,"fructose_g":7.8,"glucose_g":7.1,"sucrose_g":0.6}'::jsonb, 7),
  ((SELECT id FROM f), 'Guava', NULL, 'vegan', 'per_100g', 8.6, 8.6, 31, 31, 'low', 'moderate', 'High in fiber and vitamin C; lower sugar fruit.', ARRAY['Fiber','Vitamin C'], '{"sugar_group":"lower","total_sugars_g":5.4,"fructose_g":2.2,"glucose_g":2.3,"sucrose_g":0.9}'::jsonb, 8),
  ((SELECT id FROM f), 'Strawberry', NULL, 'vegan', 'per_100g', 7.7, 7.7, 40, 40, 'low', 'moderate', 'Low in sugar and calories; rich in antioxidants.', ARRAY['Antioxidants','Vitamin C'], '{"sugar_group":"lower","total_sugars_g":4.9,"fructose_g":2.2,"glucose_g":2.1,"sucrose_g":0.6}'::jsonb, 9),
  ((SELECT id FROM f), 'Blueberry', NULL, 'vegan', 'per_100g', 11.3, 11.3, 25, 25, 'low', 'moderate', 'Low GI and low sugar; excellent antioxidant source.', ARRAY['Antioxidants'], '{"sugar_group":"lower","total_sugars_g":7.0,"fructose_g":3.3,"glucose_g":3.3,"sucrose_g":0.4}'::jsonb, 10);

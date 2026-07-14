DROP FUNCTION IF EXISTS public.get_personalized_recipes(uuid, text, integer) CASCADE;
DROP TABLE IF EXISTS public.user_recipe_assignments CASCADE;
DROP TABLE IF EXISTS public.recipe_conditions CASCADE;
DROP TABLE IF EXISTS public.recipes CASCADE;
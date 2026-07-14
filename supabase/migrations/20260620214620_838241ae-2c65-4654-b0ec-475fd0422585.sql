
-- 1. community_post_categories table
CREATE TABLE public.community_post_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  emoji text,
  accent_color text NOT NULL DEFAULT '#1E3A8A',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.community_post_categories TO anon, authenticated;
GRANT ALL ON public.community_post_categories TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.community_post_categories TO authenticated;

ALTER TABLE public.community_post_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active categories"
  ON public.community_post_categories FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage categories - insert"
  ON public.community_post_categories FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage categories - update"
  ON public.community_post_categories FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage categories - delete"
  ON public.community_post_categories FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER community_post_categories_updated_at
  BEFORE UPDATE ON public.community_post_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.community_post_categories (slug, label, emoji, accent_color, sort_order) VALUES
  ('wins',        'Wins',              '🏆', '#E63946', 1),
  ('steps',       'Steps & Movement',  '👟', '#1E3A8A', 2),
  ('fasting',     'Fasting',           '⏱️', '#0F1A3D', 3),
  ('meals',       'Meals & Recipes',   '🍽️', '#10B981', 4),
  ('badges',      'Badges Earned',     '🎖️', '#F59E0B', 5),
  ('questions',   'Ask the Community', '💬', '#1E3A8A', 6),
  ('motivation',  'Motivation',        '✨', '#E63946', 7);

ALTER TABLE public.community_posts
  ADD COLUMN category_slug text REFERENCES public.community_post_categories(slug) ON DELETE SET NULL;

CREATE INDEX idx_community_posts_category_slug ON public.community_posts(category_slug);
CREATE INDEX idx_community_posts_created_at_desc ON public.community_posts(created_at DESC);

ALTER TABLE public.thyrocare_tests
  ADD COLUMN foundation_default boolean NOT NULL DEFAULT false;

UPDATE public.thyrocare_tests
   SET foundation_default = true
 WHERE product_code IN ('PROJ1062518', 'PROJ1062519', 'PROJ1062521');

DELETE FROM public.rbac_permissions WHERE role = 'user' AND package_key IN ('foundation','active','intensive');

INSERT INTO public.rbac_permissions (role, package_key, module, sub_module, can_view, can_edit, can_delete) VALUES
  ('user','foundation','overview',     NULL,            true,false,false),
  ('user','foundation','diet',         NULL,            true,false,false),
  ('user','foundation','diet',         'categories',    true,false,false),
  ('user','foundation','diet',         'food_items',    true,false,false),
  ('user','foundation','diet',         'tags',          true,false,false),
  ('user','foundation','diet',         'filters',       true,false,false),
  ('user','foundation','diet',         'plates',        true,true, false),
  ('user','foundation','supplements',  NULL,            true,false,false),
  ('user','foundation','supplements',  'list',          true,false,false),
  ('user','foundation','fasting',      NULL,            true,false,false),
  ('user','foundation','fasting',      'protocols',     true,false,false),
  ('user','foundation','fasting',      'tracking',      true,true, false),
  ('user','foundation','fasting',      'badges',        true,false,false),
  ('user','foundation','fasting',      'weekly_plans',  true,false,false),
  ('user','foundation','lab_tests',    NULL,            true,false,false),
  ('user','foundation','lab_tests',    'tests',         true,false,false),
  ('user','foundation','lab_tests',    'orders',        true,true, false),
  ('user','foundation','lab_tests',    'reports',       true,false,false),
  ('user','foundation','exercises',    NULL,            true,false,false),
  ('user','foundation','exercises',    'categories',    true,false,false),
  ('user','foundation','exercises',    'videos',        true,false,false),
  ('user','foundation','movement',     NULL,            true,true, false),
  ('user','foundation','community',    NULL,            true,true, true);

INSERT INTO public.rbac_permissions (role, package_key, module, sub_module, can_view, can_edit, can_delete) VALUES
  ('user','active','overview',     NULL,            true,false,false),
  ('user','active','diet',         NULL,            true,false,false),
  ('user','active','diet',         'categories',    true,false,false),
  ('user','active','diet',         'food_items',    true,false,false),
  ('user','active','diet',         'tags',          true,false,false),
  ('user','active','diet',         'filters',       true,false,false),
  ('user','active','diet',         'plates',        true,true, false),
  ('user','active','supplements',  NULL,            true,false,false),
  ('user','active','supplements',  'list',          true,false,false),
  ('user','active','supplements',  'conditions',    true,false,false),
  ('user','active','supplements',  'badges',        true,false,false),
  ('user','active','fasting',      NULL,            true,false,false),
  ('user','active','fasting',      'protocols',     true,false,false),
  ('user','active','fasting',      'tracking',      true,true, false),
  ('user','active','fasting',      'badges',        true,false,false),
  ('user','active','fasting',      'weekly_plans',  true,false,false),
  ('user','active','lab_tests',    NULL,            true,false,false),
  ('user','active','lab_tests',    'tests',         true,false,false),
  ('user','active','lab_tests',    'recommendations', true,false,false),
  ('user','active','lab_tests',    'orders',        true,true, false),
  ('user','active','lab_tests',    'reports',       true,false,false),
  ('user','active','exercises',    NULL,            true,false,false),
  ('user','active','exercises',    'videos',        true,false,false),
  ('user','active','exercises',    'categories',    true,false,false),
  ('user','active','movement',     NULL,            true,true, false),
  ('user','active','community',    NULL,            true,true, true),
  ('user','active','coaches',      NULL,            true,false,false),
  ('user','active','coaches',      'list',          true,false,false),
  ('user','active','coaches',      'ratings',       true,true, false);

INSERT INTO public.rbac_permissions (role, package_key, module, sub_module, can_view, can_edit, can_delete) VALUES
  ('user','intensive','overview',     NULL,            true,false,false),
  ('user','intensive','diet',         NULL,            true,false,false),
  ('user','intensive','diet',         'categories',    true,false,false),
  ('user','intensive','diet',         'food_items',    true,false,false),
  ('user','intensive','diet',         'tags',          true,false,false),
  ('user','intensive','diet',         'filters',       true,false,false),
  ('user','intensive','diet',         'plates',        true,true, false),
  ('user','intensive','supplements',  NULL,            true,false,false),
  ('user','intensive','supplements',  'list',          true,false,false),
  ('user','intensive','supplements',  'conditions',    true,false,false),
  ('user','intensive','supplements',  'badges',        true,false,false),
  ('user','intensive','fasting',      NULL,            true,false,false),
  ('user','intensive','fasting',      'protocols',     true,false,false),
  ('user','intensive','fasting',      'tracking',      true,true, false),
  ('user','intensive','fasting',      'badges',        true,false,false),
  ('user','intensive','fasting',      'weekly_plans',  true,false,false),
  ('user','intensive','lab_tests',    NULL,            true,false,false),
  ('user','intensive','lab_tests',    'tests',         true,false,false),
  ('user','intensive','lab_tests',    'recommendations', true,false,false),
  ('user','intensive','lab_tests',    'orders',        true,true, false),
  ('user','intensive','lab_tests',    'reports',       true,false,false),
  ('user','intensive','exercises',    NULL,            true,false,false),
  ('user','intensive','exercises',    'videos',        true,false,false),
  ('user','intensive','exercises',    'categories',    true,false,false),
  ('user','intensive','movement',     NULL,            true,true, false),
  ('user','intensive','community',    NULL,            true,true, true),
  ('user','intensive','coaches',      NULL,            true,false,false),
  ('user','intensive','coaches',      'list',          true,false,false),
  ('user','intensive','coaches',      'ratings',       true,true, false);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_posts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_comments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments';
  END IF;
END$$;

ALTER TABLE public.community_posts REPLICA IDENTITY FULL;
ALTER TABLE public.community_comments REPLICA IDENTITY FULL;


-- Video categories table
CREATE TABLE public.video_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Videos table (metadata only)
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_video_id TEXT NOT NULL,
  source_platform TEXT NOT NULL DEFAULT 'youtube',
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  category_ids UUID[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  level TEXT NOT NULL DEFAULT 'beginner',
  language TEXT NOT NULL DEFAULT 'en',
  instructor_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(external_video_id, source_platform)
);

-- Seed default categories
INSERT INTO public.video_categories (name, slug, sort_order) VALUES
  ('Yoga', 'yoga', 1),
  ('Pranayam (Breathing)', 'pranayam', 2),
  ('Guided Meditation', 'guided-meditation', 3),
  ('Yoga Nidra', 'yoga-nidra', 4),
  ('Sleep & Recovery', 'sleep-recovery', 5),
  ('Face Yoga', 'face-yoga', 6),
  ('Stress Relief Quick Sessions', 'stress-relief', 7),
  ('Mindfulness', 'mindfulness', 8),
  ('Relaxation Music / Sound Therapy', 'sound-therapy', 9),
  ('Beginner Programs', 'beginner-programs', 10),
  ('Advanced Practices', 'advanced-practices', 11);

-- RLS
ALTER TABLE public.video_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Categories: anyone authenticated can view active ones, admins can manage all
CREATE POLICY "Anyone can view active categories" ON public.video_categories FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage categories" ON public.video_categories FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Videos: anyone authenticated can view active, admins full CRUD
CREATE POLICY "Anyone can view active videos" ON public.videos FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage videos" ON public.videos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER set_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.video_thumbnails (
  video_id TEXT PRIMARY KEY,
  thumbnail_url TEXT NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.video_thumbnails TO anon, authenticated;
GRANT ALL ON public.video_thumbnails TO authenticated, service_role;
ALTER TABLE public.video_thumbnails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view thumbnails" ON public.video_thumbnails FOR SELECT USING (true);
CREATE POLICY "Admins manage thumbnails" ON public.video_thumbnails FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
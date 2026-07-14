
CREATE TABLE public.video_metadata (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id text NOT NULL UNIQUE,
  name text,
  category text,
  icon text,
  youtube_id text,
  group_name text,
  tags text[],
  benefits text,
  suitable_for text,
  not_suitable_for text,
  dos text,
  donts text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.video_metadata TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_metadata TO authenticated;
GRANT ALL ON public.video_metadata TO service_role;

ALTER TABLE public.video_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read video metadata overrides"
  ON public.video_metadata FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage video metadata"
  ON public.video_metadata FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

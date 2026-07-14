CREATE TABLE public.video_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  youtube_id TEXT,
  progress_sec INTEGER NOT NULL DEFAULT 0,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, video_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_progress TO authenticated;
GRANT ALL ON public.video_progress TO service_role;

ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own video progress"
ON public.video_progress FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_video_progress_user ON public.video_progress(user_id, watched_at DESC);

CREATE TRIGGER trg_video_progress_updated_at
BEFORE UPDATE ON public.video_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
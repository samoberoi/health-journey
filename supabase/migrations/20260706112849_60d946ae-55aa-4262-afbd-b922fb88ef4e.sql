UPDATE public.exercises
SET youtube_url = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
WHERE youtube_url IS NULL
   OR youtube_url = ''
   OR youtube_url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

ALTER TABLE public.exercises
  ALTER COLUMN youtube_url SET DEFAULT 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
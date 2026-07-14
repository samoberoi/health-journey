
CREATE OR REPLACE FUNCTION public.recompute_coach_rating(_coach_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.coaches c
  SET total_ratings = COALESCE(s.cnt, 0),
      avg_rating    = COALESCE(ROUND(s.avg_r::numeric, 1), 0.0)
  FROM (
    SELECT coach_id, COUNT(*) AS cnt, AVG(rating) AS avg_r
    FROM public.coach_ratings
    WHERE coach_id = _coach_id
    GROUP BY coach_id
  ) s
  WHERE c.id = _coach_id
    AND (s.coach_id = c.id OR s.coach_id IS NULL);

  UPDATE public.coaches
  SET total_ratings = 0, avg_rating = 0.0
  WHERE id = _coach_id
    AND NOT EXISTS (SELECT 1 FROM public.coach_ratings WHERE coach_id = _coach_id);
$$;

CREATE OR REPLACE FUNCTION public.coach_ratings_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_coach_rating(OLD.coach_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.coach_id <> NEW.coach_id THEN
    PERFORM public.recompute_coach_rating(OLD.coach_id);
    PERFORM public.recompute_coach_rating(NEW.coach_id);
    RETURN NEW;
  ELSE
    PERFORM public.recompute_coach_rating(NEW.coach_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_coach_ratings_sync ON public.coach_ratings;
CREATE TRIGGER trg_coach_ratings_sync
AFTER INSERT OR UPDATE OR DELETE ON public.coach_ratings
FOR EACH ROW EXECUTE FUNCTION public.coach_ratings_sync();

-- Backfill all coaches from real ratings now
UPDATE public.coaches c
SET total_ratings = COALESCE(s.cnt, 0),
    avg_rating    = COALESCE(ROUND(s.avg_r::numeric, 1), 0.0)
FROM (
  SELECT id AS coach_id,
         (SELECT COUNT(*) FROM public.coach_ratings r WHERE r.coach_id = coaches.id) AS cnt,
         (SELECT AVG(rating) FROM public.coach_ratings r WHERE r.coach_id = coaches.id) AS avg_r
  FROM public.coaches
) s
WHERE c.id = s.coach_id;

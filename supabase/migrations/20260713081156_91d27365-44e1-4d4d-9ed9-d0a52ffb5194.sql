
-- 1) Config table
CREATE TABLE IF NOT EXISTS public.fasting_stage_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id uuid NOT NULL REFERENCES public.fasting_badges(id) ON DELETE CASCADE,
  milestone_order int NOT NULL,
  name text NOT NULL,
  description text,
  compliant_days_required int NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(badge_id, milestone_order)
);
GRANT SELECT ON public.fasting_stage_milestones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fasting_stage_milestones TO authenticated;
GRANT ALL ON public.fasting_stage_milestones TO service_role;
ALTER TABLE public.fasting_stage_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "milestones readable by all" ON public.fasting_stage_milestones;
CREATE POLICY "milestones readable by all" ON public.fasting_stage_milestones FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage milestones" ON public.fasting_stage_milestones;
CREATE POLICY "admins manage milestones" ON public.fasting_stage_milestones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Link user_fasting_milestones to config rows
ALTER TABLE public.user_fasting_milestones
  ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES public.fasting_stage_milestones(id) ON DELETE CASCADE;

-- Old unique constraint (user_id, badge_id, week_number) — replace with (user_id, milestone_id)
DO $$
DECLARE cn text;
BEGIN
  SELECT conname INTO cn FROM pg_constraint
  WHERE conrelid = 'public.user_fasting_milestones'::regclass AND contype = 'u'
  LIMIT 1;
  IF cn IS NOT NULL THEN EXECUTE format('ALTER TABLE public.user_fasting_milestones DROP CONSTRAINT %I', cn); END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS user_fasting_milestones_user_milestone_uidx
  ON public.user_fasting_milestones(user_id, milestone_id);

-- 3) Seed default milestones (one per week in each stage) if none exist for that stage
INSERT INTO public.fasting_stage_milestones (badge_id, milestone_order, name, description, compliant_days_required)
SELECT
  b.id,
  gs.wk,
  b.badge_name || ' — Milestone ' || gs.wk,
  'Complete week ' || gs.wk || ' of the ' || b.pattern || ' phase',
  gs.wk * 5
FROM public.fasting_badges b
CROSS JOIN LATERAL generate_series(1, COALESCE(b.milestones_required, 1)) AS gs(wk)
WHERE b.badge_type = 'stage'
  AND NOT EXISTS (SELECT 1 FROM public.fasting_stage_milestones m WHERE m.badge_id = b.id);

-- 4) updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_fasting_stage_milestones()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_touch_fsm ON public.fasting_stage_milestones;
CREATE TRIGGER trg_touch_fsm BEFORE UPDATE ON public.fasting_stage_milestones
  FOR EACH ROW EXECUTE FUNCTION public.touch_fasting_stage_milestones();

-- 5) Rewrite award function to use configured milestones
CREATE OR REPLACE FUNCTION public.award_fasting_badges(_user_id uuid)
RETURNS TABLE(current_streak int, longest_streak int, newly_awarded int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _dates date[];
  _cur int; _lng int;
  _new int := 0;
  _up record;
  _stage record;
  _m record;
  _compliant_days int;
  _total_ms int;
  _achieved_ms int;
  _master_added int;
BEGIN
  SELECT array_agg(DISTINCT date) INTO _dates
  FROM public.fasting_tracking
  WHERE user_id = _user_id
    AND (compliance_status IN ('completed','partial')
         OR (fmod_actual_time IS NOT NULL AND lmod_actual_time IS NOT NULL)
         OR COALESCE(fasting_hours_completed,0) > 0);

  SELECT s.current_streak, s.longest_streak INTO _cur, _lng
  FROM public.streak_from_dates(_dates, _today) s;
  _cur := COALESCE(_cur,0); _lng := COALESCE(_lng,0);

  FOR _up IN
    SELECT * FROM public.user_protocols
    WHERE user_id = _user_id AND status = 'active'
  LOOP
    FOR _stage IN
      SELECT * FROM public.fasting_badges
      WHERE protocol_id = _up.protocol_id AND badge_type = 'stage'
      ORDER BY stage_order
    LOOP
      -- Compliant days accumulated within this stage's window (from user's start_date)
      SELECT COUNT(*)::int INTO _compliant_days
      FROM public.fasting_tracking
      WHERE user_id = _user_id
        AND date BETWEEN
              _up.start_date + ((COALESCE(_stage.week_range_start,1) - 1) * 7)
          AND LEAST(_today, _up.start_date + (COALESCE(_stage.week_range_end,1) * 7) - 1)
        AND (compliance_status IN ('completed','partial')
             OR (fmod_actual_time IS NOT NULL AND lmod_actual_time IS NOT NULL)
             OR COALESCE(fasting_hours_completed,0) > 0);

      -- Award every configured milestone whose threshold is met
      FOR _m IN
        SELECT * FROM public.fasting_stage_milestones
        WHERE badge_id = _stage.id
        ORDER BY milestone_order
      LOOP
        IF _compliant_days >= _m.compliant_days_required THEN
          INSERT INTO public.user_fasting_milestones(user_id, badge_id, milestone_id, week_number)
          VALUES (_user_id, _stage.id, _m.id, _m.milestone_order)
          ON CONFLICT (user_id, milestone_id) DO NOTHING;
        END IF;
      END LOOP;

      -- Award stage badge only when every configured milestone is achieved
      SELECT COUNT(*)::int INTO _total_ms
      FROM public.fasting_stage_milestones WHERE badge_id = _stage.id;
      SELECT COUNT(*)::int INTO _achieved_ms
      FROM public.user_fasting_milestones ufm
      JOIN public.fasting_stage_milestones fsm ON fsm.id = ufm.milestone_id
      WHERE ufm.user_id = _user_id AND fsm.badge_id = _stage.id;

      IF _total_ms > 0 AND _achieved_ms >= _total_ms AND NOT EXISTS (
        SELECT 1 FROM public.user_fasting_badges
        WHERE user_id = _user_id AND badge_id = _stage.id
      ) THEN
        INSERT INTO public.user_fasting_badges(user_id, badge_id, current_streak, longest_streak)
        VALUES (_user_id, _stage.id, _cur, _lng);
        _new := _new + 1;
      END IF;
    END LOOP;

    -- Master badge when all stages earned
    IF NOT EXISTS (
      SELECT 1 FROM public.fasting_badges sb
      WHERE sb.protocol_id = _up.protocol_id AND sb.badge_type = 'stage'
        AND NOT EXISTS (
          SELECT 1 FROM public.user_fasting_badges ub
          WHERE ub.user_id = _user_id AND ub.badge_id = sb.id
        )
    ) THEN
      WITH ins AS (
        INSERT INTO public.user_fasting_badges(user_id, badge_id, current_streak, longest_streak)
        SELECT _user_id, m.id, _cur, _lng
        FROM public.fasting_badges m
        WHERE m.protocol_id = _up.protocol_id AND m.badge_type = 'master'
          AND NOT EXISTS (
            SELECT 1 FROM public.user_fasting_badges ub
            WHERE ub.user_id = _user_id AND ub.badge_id = m.id
          )
        RETURNING 1
      )
      SELECT COUNT(*)::int INTO _master_added FROM ins;
      _new := _new + COALESCE(_master_added, 0);
    END IF;
  END LOOP;

  UPDATE public.user_fasting_badges
    SET current_streak = _cur, longest_streak = _lng
  WHERE user_id = _user_id;

  RETURN QUERY SELECT _cur, _lng, _new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_fasting_badges(uuid) TO authenticated, service_role;

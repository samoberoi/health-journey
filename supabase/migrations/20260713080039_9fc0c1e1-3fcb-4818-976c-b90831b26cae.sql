
ALTER TABLE public.fasting_badges
  ADD COLUMN IF NOT EXISTS protocol_id uuid REFERENCES public.fasting_protocols(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_badge_id uuid REFERENCES public.fasting_badges(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS badge_type text NOT NULL DEFAULT 'stage',
  ADD COLUMN IF NOT EXISTS pattern text,
  ADD COLUMN IF NOT EXISTS milestones_required int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stage_order int NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.user_fasting_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.fasting_badges(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id, week_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_fasting_milestones TO authenticated;
GRANT ALL ON public.user_fasting_milestones TO service_role;
ALTER TABLE public.user_fasting_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own milestones" ON public.user_fasting_milestones;
CREATE POLICY "users manage own milestones" ON public.user_fasting_milestones
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DO $seed$
DECLARE
  proto record; grp record; master_id uuid; stg int;
  master_names jsonb := '{"basic":"Metabolic Warrior","moderate":"Metabolic Guardian","severe":"Metabolic Champion"}'::jsonb;
  master_emojis jsonb := '{"basic":"⚔️","moderate":"🛡️","severe":"👑"}'::jsonb;
  pattern_emojis jsonb := '{"12:12":"🌱","13:11":"🌿","14:10":"🔥","16:08":"⚡","18:06":"🧬","20:04":"💎"}'::jsonb;
  pattern_names jsonb := '{"12:12":"Foundation Faster","13:11":"Rhythm Builder","14:10":"Fat Burner Initiate","16:08":"Ketone Master","18:06":"Autophagy Elite","20:04":"Metabolic Sage"}'::jsonb;
BEGIN
  DELETE FROM public.user_fasting_milestones;
  DELETE FROM public.user_fasting_badges;
  DELETE FROM public.fasting_badges;

  FOR proto IN SELECT * FROM public.fasting_protocols ORDER BY protocol_type LOOP
    INSERT INTO public.fasting_badges (
      badge_key, badge_name, badge_emoji, level, required_streak_days,
      protocol_id, badge_type, milestones_required, stage_order, description
    ) VALUES (
      'master_'||proto.protocol_type,
      COALESCE(master_names->>proto.protocol_type, proto.protocol_name),
      COALESCE(master_emojis->>proto.protocol_type, '🏆'),
      0, proto.total_weeks * 7,
      proto.id, 'master', proto.total_weeks, 0,
      'Complete all '||proto.total_weeks||' weeks of the '||proto.protocol_name
    ) RETURNING id INTO master_id;

    stg := 1;
    FOR grp IN
      WITH numbered AS (
        SELECT week_number, fasting_pattern,
          week_number - ROW_NUMBER() OVER (PARTITION BY fasting_pattern ORDER BY week_number) AS g
        FROM public.fasting_weekly_plans WHERE protocol_id = proto.id
      )
      SELECT fasting_pattern AS pattern,
             MIN(week_number)::int AS start_w,
             MAX(week_number)::int AS end_w
      FROM numbered
      GROUP BY fasting_pattern, g
      ORDER BY MIN(week_number)
    LOOP
      INSERT INTO public.fasting_badges (
        badge_key, badge_name, badge_emoji, level, required_streak_days,
        protocol_id, parent_badge_id, badge_type, pattern,
        milestones_required, stage_order, week_range_start, week_range_end,
        description
      ) VALUES (
        'stage_'||proto.protocol_type||'_'||stg,
        COALESCE(pattern_names->>grp.pattern, grp.pattern||' Master'),
        COALESCE(pattern_emojis->>grp.pattern, '⭐'),
        stg,
        (grp.end_w - grp.start_w + 1) * 7,
        proto.id, master_id, 'stage', grp.pattern,
        (grp.end_w - grp.start_w + 1), stg,
        grp.start_w, grp.end_w,
        'Complete '||(grp.end_w - grp.start_w + 1)||' week'||CASE WHEN (grp.end_w - grp.start_w + 1) > 1 THEN 's' ELSE '' END||' of '||grp.pattern||' fasting (weeks '||grp.start_w||'–'||grp.end_w||')'
      );
      stg := stg + 1;
    END LOOP;
  END LOOP;
END
$seed$;

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
  _week int;
  _week_start date;
  _week_end date;
  _compliant_days int;
  _all_done boolean;
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
      FOR _week IN COALESCE(_stage.week_range_start,1)..COALESCE(_stage.week_range_end,1) LOOP
        _week_start := _up.start_date + ((_week - 1) * 7);
        _week_end := _week_start + 6;
        IF _week_end > _today THEN CONTINUE; END IF;

        SELECT COUNT(*)::int INTO _compliant_days
        FROM public.fasting_tracking
        WHERE user_id = _user_id
          AND date BETWEEN _week_start AND _week_end
          AND (compliance_status IN ('completed','partial')
               OR (fmod_actual_time IS NOT NULL AND lmod_actual_time IS NOT NULL)
               OR COALESCE(fasting_hours_completed,0) > 0);

        IF _compliant_days >= 5 THEN
          INSERT INTO public.user_fasting_milestones(user_id, badge_id, week_number)
          VALUES (_user_id, _stage.id, _week)
          ON CONFLICT (user_id, badge_id, week_number) DO NOTHING;
        END IF;
      END LOOP;

      SELECT (COUNT(*) >= _stage.milestones_required) INTO _all_done
      FROM public.user_fasting_milestones
      WHERE user_id = _user_id AND badge_id = _stage.id;

      IF _all_done AND NOT EXISTS (
        SELECT 1 FROM public.user_fasting_badges
        WHERE user_id = _user_id AND badge_id = _stage.id
      ) THEN
        INSERT INTO public.user_fasting_badges(user_id, badge_id, current_streak, longest_streak)
        VALUES (_user_id, _stage.id, _cur, _lng);
        _new := _new + 1;
      END IF;
    END LOOP;

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

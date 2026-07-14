
-- Clear any prior awards + generic badge defs so we can reseed cleanly.
DELETE FROM public.user_fasting_badges;
DELETE FROM public.fasting_badges;

-- Helper values
DO $$
DECLARE
  _foundation uuid := (SELECT id FROM public.fasting_protocols WHERE protocol_type='basic'    LIMIT 1);
  _moderate   uuid := (SELECT id FROM public.fasting_protocols WHERE protocol_type='moderate' LIMIT 1);
  _severe     uuid := (SELECT id FROM public.fasting_protocols WHERE protocol_type='severe'   LIMIT 1);
  _master_id  uuid;
BEGIN
  -- ── Foundation Care Plan (12 weeks) ───────────────────────────────
  INSERT INTO public.fasting_badges
    (badge_key, badge_name, badge_emoji, description, level, required_streak_days,
     week_range_start, week_range_end, protocol_id, badge_type, pattern, stage_order)
  VALUES ('foundation_master', 'Foundation Guardian', '🛡️',
          'Completed the full 12-week Foundation Care Plan. You built the base for lifelong metabolic health.',
          40, 84, 1, 12, _foundation, 'master', '16:08', 99)
  RETURNING id INTO _master_id;

  INSERT INTO public.fasting_badges
    (badge_key, badge_name, badge_emoji, description, level, required_streak_days,
     week_range_start, week_range_end, protocol_id, parent_badge_id, badge_type, pattern, stage_order) VALUES
    ('foundation_s1','First Light',            '🌅', 'Completed 2 weeks on the 12:12 window — you have started the shift.',
        1, 14, 1, 2,  _foundation, _master_id, 'stage', '12:12', 1),
    ('foundation_s2','Rhythm Keeper',          '🌿', 'Held the 14:10 window for a month — a steadier metabolism is forming.',
        2, 42, 3, 6,  _foundation, _master_id, 'stage', '14:10', 2),
    ('foundation_s3','Sixteen-Eight Sentinel', '⚡', 'Sustained the 16:08 window through week 12 — fat-burning mode is now familiar.',
        3, 84, 7, 12, _foundation, _master_id, 'stage', '16:08', 3);

  -- ── Active Health Tracking (24 weeks) ─────────────────────────────
  INSERT INTO public.fasting_badges
    (badge_key, badge_name, badge_emoji, description, level, required_streak_days,
     week_range_start, week_range_end, protocol_id, badge_type, pattern, stage_order)
  VALUES ('moderate_master', 'Active Reversal Master', '🏅',
          'Completed the full 24-week Active Health Tracking protocol. Your body is running on a new baseline.',
          50, 168, 1, 24, _moderate, 'master', '18:06', 99)
  RETURNING id INTO _master_id;

  INSERT INTO public.fasting_badges
    (badge_key, badge_name, badge_emoji, description, level, required_streak_days,
     week_range_start, week_range_end, protocol_id, parent_badge_id, badge_type, pattern, stage_order) VALUES
    ('moderate_s1','Steady Starter',       '🌱', 'Stabilised on 14:10 for two solid weeks.',
        11,  14,  1,  2, _moderate, _master_id, 'stage', '14:10', 1),
    ('moderate_s2','Push Pioneer',         '🚀', 'Held 14:10 with weekly 16:08 pushes through week 4.',
        12,  28,  3,  4, _moderate, _master_id, 'stage', '14:10', 2),
    ('moderate_s3','Fat-Burn Adept',       '🔥', 'Locked in 16:08 for a full month.',
        13,  56,  5,  8, _moderate, _master_id, 'stage', '16:08', 3),
    ('moderate_s4','Insulin Whisperer',    '🧬', 'Pushed to 18:06 twice a week for a month — insulin is listening.',
        14,  84,  9, 12, _moderate, _master_id, 'stage', '16:08', 4),
    ('moderate_s5','Deep Reset Voyager',   '🌊', 'Sustained 18:06 for two months of therapeutic fasting.',
        15, 140, 13, 20, _moderate, _master_id, 'stage', '18:06', 5);

  -- ── Intensive Reversal Care (24 weeks) ────────────────────────────
  INSERT INTO public.fasting_badges
    (badge_key, badge_name, badge_emoji, description, level, required_streak_days,
     week_range_start, week_range_end, protocol_id, badge_type, pattern, stage_order)
  VALUES ('severe_master', 'Intensive Reversal Legend', '👑',
          'Completed the full 24-week Intensive Reversal Care protocol under coach supervision. This is transformation.',
          60, 168, 1, 24, _severe, 'master', '18:06', 99)
  RETURNING id INTO _master_id;

  INSERT INTO public.fasting_badges
    (badge_key, badge_name, badge_emoji, description, level, required_streak_days,
     week_range_start, week_range_end, protocol_id, parent_badge_id, badge_type, pattern, stage_order) VALUES
    ('severe_s1','Brave First Step',        '🌟',  'Completed week 1 on 12:12 — the hardest step is behind you.',
        21,   7,  1,  1, _severe, _master_id, 'stage', '12:12', 1),
    ('severe_s2','Thirteen-Hour Threshold', '⏳',  'Extended to 13:11 in week 2.',
        22,  14,  2,  2, _severe, _master_id, 'stage', '13:11', 2),
    ('severe_s3','Fourteen-Ten Titan',      '🏋️', 'Held 14:10 with weekly 16:08 pushes through week 8.',
        23,  56,  3,  8, _severe, _master_id, 'stage', '14:10', 3),
    ('severe_s4','Sixteen-Eight Warrior',   '⚔️',  'Stabilised on 16:08 through week 10.',
        24,  70,  9, 10, _severe, _master_id, 'stage', '16:08', 4),
    ('severe_s5','Eighteen-Six Ascendant',  '🌄',  'Pushed to 18:06 with coach guidance through week 12.',
        25,  84, 11, 12, _severe, _master_id, 'stage', '16:08', 5),
    ('severe_s6','Cellular Renewal',        '🧪',  'Sustained 18:06 through week 20 — deep autophagy territory.',
        26, 140, 13, 20, _severe, _master_id, 'stage', '18:06', 6);
END $$;

-- ── Award routine: only consider badges tied to the user's active protocol ──
CREATE OR REPLACE FUNCTION public.award_fasting_badges(_user_id uuid)
 RETURNS TABLE(current_streak integer, longest_streak integer, newly_awarded integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _dates date[];
  _cur int; _lng int;
  _proto uuid;
  _b record;
  _new int := 0;
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

  SELECT protocol_id INTO _proto
  FROM public.user_protocols
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF _proto IS NOT NULL THEN
    FOR _b IN
      SELECT * FROM public.fasting_badges
      WHERE protocol_id = _proto
      ORDER BY stage_order, level
    LOOP
      IF _lng >= _b.required_streak_days
         AND NOT EXISTS (SELECT 1 FROM public.user_fasting_badges
                         WHERE user_id=_user_id AND badge_id=_b.id) THEN
        INSERT INTO public.user_fasting_badges(user_id, badge_id, current_streak, longest_streak)
        VALUES (_user_id, _b.id, _cur, _lng);
        _new := _new + 1;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.user_fasting_badges
    SET current_streak = _cur, longest_streak = _lng
  WHERE user_id = _user_id;

  RETURN QUERY SELECT _cur, _lng, _new;
END;
$function$;

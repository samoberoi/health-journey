DO $$
DECLARE
  cat uuid;
BEGIN
  SELECT id INTO cat FROM public.notification_categories WHERE key = 'movement' LIMIT 1;
  IF cat IS NULL THEN RETURN; END IF;

  INSERT INTO public.notification_templates
    (category_id, key, title, description, trigger_type, audience_filter, message_variants, icon, action_url, send_time_local, send_days, cooldown_hours, timezone, is_active)
  VALUES
    (cat, 'move_not_started_9am', 'Time to move', 'Nudge users with zero steps by 9am',
     'reminder',
     '{"patient_users":true,"no_movement_started_today":true}'::jsonb,
     '["Zero steps so far — a 5-minute walk right now sets the tone for the whole day.","Your body has been still all morning. Stand up, roll your shoulders, take the first 500 steps.","The best glucose regulator is the next 10 minutes of walking. Lace up."]'::jsonb,
     '🚶', '/patient/movement', '09:00:00', ARRAY[1,2,3,4,5,6,7], 20, 'Asia/Kolkata', true),

    (cat, 'move_goal_met_early', 'You already crushed your steps!', 'Congratulate early goal-hitters',
     'celebration',
     '{"patient_users":true,"movement_goal_met_early":true}'::jsonb,
     '["Steps goal hit before noon — legendary. Tap to share your win with the community.","You finished before most people started. Post it, inspire someone else today.","Goal complete already! Everything else today is a bonus round."]'::jsonb,
     '🏆', '/community', '10:30:00', ARRAY[1,2,3,4,5,6,7], 20, 'Asia/Kolkata', true),

    (cat, 'move_break_afternoon', 'Post-lunch 10-minute walk', 'Universal afternoon movement break',
     'reminder',
     '{"patient_users":true}'::jsonb,
     '["Post-lunch glucose spike incoming. A 10-minute walk right now flattens it — no exceptions.","Sitting is the new sugar. Stand up, walk 10 minutes, come back sharper.","Doesn''t matter if you hit your steps already — a walk after lunch is non-negotiable."]'::jsonb,
     '🥗', '/patient/movement', '14:00:00', ARRAY[1,2,3,4,5,6,7], 4, 'Asia/Kolkata', true),

    (cat, 'move_break_evening', 'Evening reset walk', 'Universal evening movement break',
     'reminder',
     '{"patient_users":true}'::jsonb,
     '["Screen fatigue building up? 10 minutes outside resets your posture, mood and glucose.","Golden-hour walk — best time of day to move. Go.","Break the afternoon slump. 10 minutes, that''s it."]'::jsonb,
     '🌇', '/patient/movement', '17:00:00', ARRAY[1,2,3,4,5,6,7], 4, 'Asia/Kolkata', true),

    (cat, 'move_after_dinner', 'After-dinner walk', 'Universal post-dinner movement break',
     'reminder',
     '{"patient_users":true}'::jsonb,
     '["The single most powerful thing for tomorrow''s fasting glucose: walk 10 minutes after dinner.","Digestion + glucose control in one shot. Ten minutes, gentle pace, right now.","One last walk. Your morning-you will thank tonight-you."]'::jsonb,
     '🌙', '/patient/movement', '20:30:00', ARRAY[1,2,3,4,5,6,7], 4, 'Asia/Kolkata', true)

  ON CONFLICT (key) DO UPDATE SET
    category_id      = EXCLUDED.category_id,
    title            = EXCLUDED.title,
    description      = EXCLUDED.description,
    trigger_type     = EXCLUDED.trigger_type,
    audience_filter  = EXCLUDED.audience_filter,
    message_variants = EXCLUDED.message_variants,
    icon             = EXCLUDED.icon,
    action_url       = EXCLUDED.action_url,
    send_time_local  = EXCLUDED.send_time_local,
    send_days        = EXCLUDED.send_days,
    cooldown_hours   = EXCLUDED.cooldown_hours,
    timezone         = EXCLUDED.timezone,
    is_active        = EXCLUDED.is_active,
    updated_at       = now();
END $$;
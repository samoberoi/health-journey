
-- ─── Categories ─────────────────────────────────────────────────────────
CREATE TABLE public.notification_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🔔',
  color TEXT NOT NULL DEFAULT '#1E3A8A',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_categories TO authenticated;
GRANT ALL ON public.notification_categories TO service_role;
ALTER TABLE public.notification_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage notification categories"
  ON public.notification_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read categories"
  ON public.notification_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── Templates ──────────────────────────────────────────────────────────
CREATE TABLE public.notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.notification_categories(id) ON DELETE CASCADE,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  -- trigger_type: 'missed_action' | 'goal_met' | 'reminder' | 'share_prompt' | 'profile' | 'delivery'
  trigger_type TEXT NOT NULL DEFAULT 'reminder',
  -- audience_filter: which users are eligible. keys understood by dispatcher:
  --   has_supplements, has_movement_goal, has_fasting_protocol, has_diet_plan,
  --   missed_supplement_today, missed_movement_today, movement_goal_met_today,
  --   missed_fasting_today, missed_yoga_today, missed_meal_log_today,
  --   no_water_today, profile_incomplete, all_active_users
  audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- rotating variants; dispatcher picks by (day_of_year + user hash) % count
  message_variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  icon TEXT NOT NULL DEFAULT '🔔',
  action_url TEXT,
  send_time_local TIME NOT NULL DEFAULT '09:00',
  -- ISO weekday numbers 1..7 (Mon..Sun); empty = every day
  send_days INT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7]::INT[],
  cooldown_hours INT NOT NULL DEFAULT 20,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage notification templates"
  ON public.notification_templates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── Dispatch log (dedupe + cooldown) ───────────────────────────────────
CREATE TABLE public.notification_dispatch_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.notification_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  variant_index INT NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dispatch_log_user_template ON public.notification_dispatch_log(user_id, template_id, sent_at DESC);
GRANT SELECT ON public.notification_dispatch_log TO authenticated;
GRANT ALL ON public.notification_dispatch_log TO service_role;
ALTER TABLE public.notification_dispatch_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view dispatch log"
  ON public.notification_dispatch_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ─── updated_at triggers ────────────────────────────────────────────────
CREATE TRIGGER update_notification_categories_updated_at
  BEFORE UPDATE ON public.notification_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Seed categories ────────────────────────────────────────────────────
INSERT INTO public.notification_categories (key, label, icon, color, sort_order) VALUES
  ('food',        'Food',        '🥗', '#10B981', 1),
  ('fasting',     'Fasting',     '⏱️', '#1E3A8A', 2),
  ('movement',    'Movement',    '👟', '#F59E0B', 3),
  ('supplements', 'Supplements', '💊', '#8B5CF6', 4),
  ('stress',      'Stress & Yoga','🧘', '#06B6D4', 5),
  ('profile',     'Profile',     '👤', '#0F1A3D', 6),
  ('community',   'Community',   '📣', '#E63946', 7);

-- ─── Seed templates ─────────────────────────────────────────────────────
WITH cats AS (SELECT key, id FROM public.notification_categories)
INSERT INTO public.notification_templates
  (category_id, key, title, trigger_type, audience_filter, message_variants, icon, action_url, send_time_local, cooldown_hours)
VALUES
  ((SELECT id FROM cats WHERE key='supplements'), 'supp_morning_reminder', 'Morning supplements', 'missed_action',
   '{"has_supplements": true, "missed_supplement_today": true}'::jsonb,
   '["Time for your morning supplements 💊 Your body is waiting.","Don''t forget — a small pill, a big difference. Take your supplements now.","Your supplements are queued up. Two minutes to consistency."]'::jsonb,
   '💊', '/home?tab=supplements', '09:00', 6),
  ((SELECT id FROM cats WHERE key='supplements'), 'supp_evening_reminder', 'Evening supplements', 'missed_action',
   '{"has_supplements": true, "missed_supplement_today": true}'::jsonb,
   '["Evening supplement window is open. Log them now to keep your streak.","Wrap the day right — your evening supplements are due.","Consistency beats intensity. Take your evening dose."]'::jsonb,
   '💊', '/home?tab=supplements', '20:00', 6),
  ((SELECT id FROM cats WHERE key='movement'), 'move_missed_morning', 'Get moving', 'missed_action',
   '{"has_movement_goal": true, "missed_movement_today": true}'::jsonb,
   '["You haven''t moved yet today. 10 minutes now = a better afternoon.","Your steps are calling. A short walk beats a long excuse.","Movement fuels metabolism. Let''s get today''s first steps in."]'::jsonb,
   '👟', '/home?tab=movement', '11:00', 8),
  ((SELECT id FROM cats WHERE key='movement'), 'move_goal_met_share', 'Steps goal hit — share it!', 'share_prompt',
   '{"movement_goal_met_today": true}'::jsonb,
   '["🎉 You hit your steps target! Share the win with the community.","Steps done for the day 👟 Tell the community — inspire someone.","Goal crushed! One tap to celebrate with the community."]'::jsonb,
   '📣', '/home?tab=community&share=movement_goal', '19:00', 20),
  ((SELECT id FROM cats WHERE key='fasting'), 'fast_start_window', 'Start your fasting window', 'reminder',
   '{"has_fasting_protocol": true, "missed_fasting_today": true}'::jsonb,
   '["Your fasting window opens soon — hydrate and start your timer.","Time to begin today''s fast. Small window, big wins.","Ready to fast? Start the clock and let your body do the work."]'::jsonb,
   '⏱️', '/home?tab=fasting', '20:00', 12),
  ((SELECT id FROM cats WHERE key='stress'), 'yoga_missed_today', 'Take 10 for yoga', 'missed_action',
   '{"missed_yoga_today": true}'::jsonb,
   '["10 minutes of yoga can reset your day. Play a session now.","Your stress deserves a break. Roll out the mat — even for 5 minutes.","Breath, stretch, reset. Your yoga session is one tap away."]'::jsonb,
   '🧘', '/home?tab=videos', '18:30', 10),
  ((SELECT id FROM cats WHERE key='food'), 'food_log_breakfast', 'Log your breakfast', 'missed_action',
   '{"missed_meal_log_today": true, "has_diet_plan": true}'::jsonb,
   '["Log your breakfast to stay on plan today.","First meal logged = full-day clarity. Add your breakfast now.","How did you fuel today? Add a photo or build your plate."]'::jsonb,
   '🥗', '/home?tab=diet', '10:30', 8),
  ((SELECT id FROM cats WHERE key='food'), 'food_log_dinner', 'Close the day — log dinner', 'missed_action',
   '{"missed_meal_log_today": true, "has_diet_plan": true}'::jsonb,
   '["Close today with a dinner log. Two taps.","End the day mindfully — record your dinner.","One last log to complete the day''s picture."]'::jsonb,
   '🥗', '/home?tab=diet', '21:00', 8),
  ((SELECT id FROM cats WHERE key='profile'), 'profile_incomplete', 'Complete your profile', 'profile',
   '{"profile_incomplete": true}'::jsonb,
   '["Your plan gets sharper when your profile is complete. 2 minutes.","Add the missing details — your coach and plan adapt to it.","Finish your profile so we can tune every recommendation for you."]'::jsonb,
   '👤', '/home?tab=profile', '12:00', 48),
  ((SELECT id FROM cats WHERE key='community'), 'community_weekly_prompt', 'Share your week', 'share_prompt',
   '{"all_active_users": true}'::jsonb,
   '["What worked for you this week? Share it — someone needs to hear it.","Your progress is someone''s inspiration. Post a quick update.","One line about your week could motivate a whole community."]'::jsonb,
   '📣', '/home?tab=community', '10:00', 168);

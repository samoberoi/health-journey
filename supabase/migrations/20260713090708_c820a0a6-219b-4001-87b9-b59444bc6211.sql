
-- 1. Add idempotency flag on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;

-- 2. Seed welcome notification template (editable in Admin > Notifications)
INSERT INTO public.notification_templates
  (category_id, key, title, description, trigger_type, audience_filter, message_variants, icon, action_url, send_time_local, send_days, cooldown_hours, timezone, is_active)
SELECT
  c.id,
  'welcome_new_user',
  'Welcome to Bye Bye Diabetes & Obesity 🌱',
  'One-time welcome notification sent when a new user signs in for the first time.',
  'welcome',
  '{"all_active_users": true}'::jsonb,
  '["Welcome to the BBDO community! We''re thrilled to have you. Explore your personalised plan, track your PUNCH habits daily, and connect with your coach anytime. Learn more at byebyediabetesandobesity.com."]'::jsonb,
  '👋',
  '/home',
  '09:00:00',
  ARRAY[0,1,2,3,4,5,6],
  0,
  'Asia/Kolkata',
  true
FROM public.notification_categories c
WHERE c.key = 'profile'
ON CONFLICT (key) DO NOTHING;

-- 3. Idempotent RPC: send welcome notification once per user, from the active template
CREATE OR REPLACE FUNCTION public.send_welcome_notification(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tpl RECORD;
  _msg text;
  _notif_id uuid;
  _already timestamptz;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;

  SELECT welcome_sent_at INTO _already FROM public.profiles WHERE id = _user_id;
  IF _already IS NOT NULL THEN RETURN NULL; END IF;

  SELECT * INTO _tpl
  FROM public.notification_templates
  WHERE key = 'welcome_new_user' AND is_active = true
  LIMIT 1;

  IF _tpl IS NULL THEN RETURN NULL; END IF;

  _msg := COALESCE((_tpl.message_variants->>0), _tpl.description, 'Welcome to BBDO!');

  _notif_id := public.create_notification(
    _user_id,
    _tpl.title,
    _msg,
    'welcome',
    COALESCE(_tpl.icon, '👋'),
    _tpl.action_url
  );

  UPDATE public.profiles SET welcome_sent_at = now() WHERE id = _user_id;
  RETURN _notif_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_welcome_notification(uuid) TO authenticated;

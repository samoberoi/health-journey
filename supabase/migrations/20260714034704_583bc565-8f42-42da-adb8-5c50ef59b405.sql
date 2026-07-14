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
  _existing_created_at timestamptz;
  _already timestamptz;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.welcome_sent_at
    INTO _already
  FROM public.profiles p
  WHERE p.user_id = _user_id
  LIMIT 1;

  SELECT n.id, n.created_at
    INTO _notif_id, _existing_created_at
  FROM public.notifications n
  WHERE n.user_id = _user_id
    AND n.type = 'welcome'
  ORDER BY n.created_at ASC
  LIMIT 1;

  IF _notif_id IS NOT NULL THEN
    UPDATE public.profiles
       SET welcome_sent_at = COALESCE(welcome_sent_at, _existing_created_at, now())
     WHERE user_id = _user_id
       AND welcome_sent_at IS NULL;
    RETURN _notif_id;
  END IF;

  IF _already IS NOT NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _tpl
  FROM public.notification_templates
  WHERE key = 'welcome_new_user'
    AND is_active = true
  LIMIT 1;

  _msg := COALESCE(
    (_tpl.message_variants->>0),
    _tpl.description,
    'Welcome to the BBDO community! Your transformation journey starts now.'
  );

  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (
    _user_id,
    COALESCE(NULLIF(trim(_tpl.title), ''), 'Welcome to Bye Bye Diabetes & Obesity 🌱'),
    _msg,
    'welcome',
    COALESCE(NULLIF(trim(_tpl.icon), ''), '👋'),
    COALESCE(NULLIF(trim(_tpl.action_url), ''), '/home')
  )
  RETURNING id INTO _notif_id;

  UPDATE public.profiles
     SET welcome_sent_at = now()
   WHERE user_id = _user_id;

  RETURN _notif_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_welcome_notification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_welcome_notification(uuid) TO service_role;

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.notifications
  WHERE type = 'welcome'
)
DELETE FROM public.notifications n
USING ranked r
WHERE n.id = r.id
  AND r.rn > 1;

WITH tpl AS (
  SELECT
    COALESCE(NULLIF(trim(title), ''), 'Welcome to Bye Bye Diabetes & Obesity 🌱') AS title,
    COALESCE((message_variants->>0), description, 'Welcome to the BBDO community! Your transformation journey starts now.') AS body,
    COALESCE(NULLIF(trim(icon), ''), '👋') AS icon,
    COALESCE(NULLIF(trim(action_url), ''), '/home') AS action_url
  FROM public.notification_templates
  WHERE key = 'welcome_new_user'
    AND is_active = true
  LIMIT 1
), fallback AS (
  SELECT
    'Welcome to Bye Bye Diabetes & Obesity 🌱'::text AS title,
    'Welcome to the BBDO community! Your transformation journey starts now.'::text AS body,
    '👋'::text AS icon,
    '/home'::text AS action_url
  WHERE NOT EXISTS (SELECT 1 FROM tpl)
), welcome_copy AS (
  SELECT * FROM tpl
  UNION ALL
  SELECT * FROM fallback
)
INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
SELECT p.user_id, w.title, w.body, 'welcome', w.icon, w.action_url
FROM public.profiles p
CROSS JOIN welcome_copy w
WHERE p.onboarding_completed IS TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = p.user_id
      AND n.type = 'welcome'
  );

UPDATE public.profiles p
   SET welcome_sent_at = first_welcome.created_at
  FROM (
    SELECT user_id, min(created_at) AS created_at
    FROM public.notifications
    WHERE type = 'welcome'
    GROUP BY user_id
  ) AS first_welcome
 WHERE p.user_id = first_welcome.user_id
   AND p.welcome_sent_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_one_welcome_per_user
ON public.notifications(user_id)
WHERE type = 'welcome';
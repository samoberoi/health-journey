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

  IF auth.uid() IS NOT NULL
     AND auth.uid() <> _user_id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'You can only create your own welcome notification' USING ERRCODE = '42501';
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

REVOKE EXECUTE ON FUNCTION public.send_welcome_notification(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_welcome_notification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_welcome_notification(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, text) TO service_role;
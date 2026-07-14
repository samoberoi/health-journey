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
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT welcome_sent_at
    INTO _already
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1;

  IF _already IS NOT NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _tpl
  FROM public.notification_templates
  WHERE key = 'welcome_new_user'
    AND is_active = true
  LIMIT 1;

  IF _tpl IS NULL THEN
    RETURN NULL;
  END IF;

  _msg := COALESCE((_tpl.message_variants->>0), _tpl.description, 'Welcome to BBDO!');

  _notif_id := public.create_notification(
    _user_id,
    _tpl.title,
    _msg,
    'welcome',
    COALESCE(_tpl.icon, '👋'),
    _tpl.action_url
  );

  UPDATE public.profiles
     SET welcome_sent_at = now()
   WHERE user_id = _user_id;

  RETURN _notif_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_welcome_notification(uuid) TO authenticated;
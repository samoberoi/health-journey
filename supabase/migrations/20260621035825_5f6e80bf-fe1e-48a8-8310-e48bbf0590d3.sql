ALTER TABLE public.notification_preferences
  ALTER COLUMN community_updates SET DEFAULT true;

UPDATE public.notification_preferences
SET community_updates = true,
    updated_at = now()
WHERE community_updates = false;

CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid,
  _title text,
  _body text,
  _type text DEFAULT 'system',
  _icon text DEFAULT '🔔',
  _action_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create notifications' USING ERRCODE = '42501';
  END IF;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Notification recipient is required' USING ERRCODE = '22004';
  END IF;

  IF length(trim(COALESCE(_title, ''))) = 0 OR length(trim(COALESCE(_body, ''))) = 0 THEN
    RAISE EXCEPTION 'Notification title and message are required' USING ERRCODE = '22023';
  END IF;

  IF auth.uid() <> _user_id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND NOT public.coach_owns_patient(_user_id) THEN
    RAISE EXCEPTION 'You can only notify yourself or assigned members' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (
    _user_id,
    left(trim(_title), 120),
    left(trim(_body), 500),
    COALESCE(NULLIF(trim(_type), ''), 'system'),
    COALESCE(NULLIF(trim(_icon), ''), '🔔'),
    NULLIF(trim(COALESCE(_action_url, '')), '')
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_community_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _post_owner uuid;
  _actor_name text;
  _enabled boolean;
BEGIN
  SELECT cp.user_id INTO _post_owner
  FROM public.community_posts cp
  WHERE cp.id = NEW.post_id;

  IF _post_owner IS NULL OR _post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(np.community_updates, true) INTO _enabled
  FROM public.notification_preferences np
  WHERE np.user_id = _post_owner;

  IF COALESCE(_enabled, true) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(trim(p.name), ''), 'A community member') INTO _actor_name
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (
    _post_owner,
    'New reply on your post',
    COALESCE(_actor_name, 'A community member') || ' replied: "' || left(trim(NEW.content), 140) || '"',
    'community_comment',
    '💬',
    '/home?tab=community'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_community_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _post_owner uuid;
  _actor_name text;
  _enabled boolean;
BEGIN
  SELECT cp.user_id INTO _post_owner
  FROM public.community_posts cp
  WHERE cp.id = NEW.post_id;

  IF _post_owner IS NULL OR _post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(np.community_updates, true) INTO _enabled
  FROM public.notification_preferences np
  WHERE np.user_id = _post_owner;

  IF COALESCE(_enabled, true) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(trim(p.name), ''), 'A community member') INTO _actor_name
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (
    _post_owner,
    'New like on your post',
    COALESCE(_actor_name, 'A community member') || ' liked your community post.',
    'community_like',
    '❤️',
    '/home?tab=community'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_community_comment ON public.community_comments;
CREATE TRIGGER trg_notify_community_comment
AFTER INSERT ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_community_comment();

DROP TRIGGER IF EXISTS trg_notify_community_like ON public.community_likes;
CREATE TRIGGER trg_notify_community_like
AFTER INSERT ON public.community_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_community_like();
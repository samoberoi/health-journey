CREATE OR REPLACE FUNCTION public.is_patient_notification_recipient(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role IN ('admin'::public.app_role, 'coach'::public.app_role, 'channel_partner'::public.app_role)
    );
$$;

REVOKE ALL ON FUNCTION public.is_patient_notification_recipient(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_patient_notification_recipient(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_patient_notification_recipient(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_patient_facing_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type = ANY (ARRAY[
    'water_reminder',
    'habit_reminder',
    'fasting_reminder',
    'supplement_reminder',
    'missed_action',
    'share_prompt',
    'profile',
    'reminder'
  ])
  AND NOT public.is_patient_notification_recipient(NEW.user_id) THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_patient_facing_notifications ON public.notifications;
CREATE TRIGGER trg_guard_patient_facing_notifications
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.guard_patient_facing_notifications();

DELETE FROM public.notifications n
USING public.user_roles ur
WHERE ur.user_id = n.user_id
  AND ur.role IN ('admin'::public.app_role, 'coach'::public.app_role, 'channel_partner'::public.app_role)
  AND n.type = ANY (ARRAY[
    'water_reminder',
    'habit_reminder',
    'fasting_reminder',
    'supplement_reminder',
    'missed_action',
    'share_prompt',
    'profile',
    'reminder'
  ]);

UPDATE public.notification_templates
SET audience_filter = COALESCE(audience_filter, '{}'::jsonb) || jsonb_build_object('patient_users', true),
    updated_at = now()
WHERE trigger_type IN ('missed_action', 'share_prompt', 'profile', 'reminder');

CREATE OR REPLACE FUNCTION public.notify_consultation_request_to_coach()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _coach_user_id uuid;
  _patient_name text;
BEGIN
  IF TG_OP <> 'INSERT' OR NEW.coach_id IS NULL OR NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT c.user_id INTO _coach_user_id
  FROM public.coaches c
  WHERE c.id = NEW.coach_id;

  IF _coach_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(trim(p.name), ''), 'A patient') INTO _patient_name
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (
    _coach_user_id,
    'New consultation request',
    COALESCE(_patient_name, 'A patient') || ' requested help: ' || left(trim(NEW.topic), 160),
    'consultation_request',
    '🗓️',
    '/coach-dashboard?tab=consultations'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_consultation_request_to_coach ON public.consultation_requests;
CREATE TRIGGER trg_notify_consultation_request_to_coach
AFTER INSERT ON public.consultation_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_consultation_request_to_coach();
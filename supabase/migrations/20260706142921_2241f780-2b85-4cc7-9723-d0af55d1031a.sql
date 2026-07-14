CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _patient_id uuid;
  _coach_user_id uuid;
  _patient_name text;
  _coach_name text;
BEGIN
  UPDATE public.chat_conversations
  SET
    last_message_at = NEW.created_at,
    coach_unread_count = CASE WHEN NEW.sender_role = 'patient' THEN coach_unread_count + 1 ELSE coach_unread_count END,
    patient_unread_count = CASE WHEN NEW.sender_role = 'coach' THEN patient_unread_count + 1 ELSE patient_unread_count END
  WHERE id = NEW.conversation_id
  RETURNING patient_id INTO _patient_id;

  SELECT c.user_id, c.name
    INTO _coach_user_id, _coach_name
  FROM public.chat_conversations cc
  JOIN public.coaches c ON c.id = cc.coach_id
  WHERE cc.id = NEW.conversation_id;

  SELECT COALESCE(NULLIF(trim(p.name), ''), 'Patient')
    INTO _patient_name
  FROM public.profiles p
  WHERE p.user_id = _patient_id;

  IF NEW.sender_role = 'patient' AND _coach_user_id IS NOT NULL AND _coach_user_id <> NEW.sender_id THEN
    INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
    VALUES (
      _coach_user_id,
      'New patient message',
      COALESCE(_patient_name, 'Patient') || ': ' || left(trim(NEW.message), 140),
      'chat_message',
      '💬',
      '/coach-dashboard?tab=messages'
    );
  ELSIF NEW.sender_role = 'coach' AND _patient_id IS NOT NULL AND _patient_id <> NEW.sender_id THEN
    INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
    VALUES (
      _patient_id,
      'New coach message',
      COALESCE(_coach_name, 'Your coach') || ': ' || left(trim(NEW.message), 140),
      'chat_message',
      '💬',
      '/home?tab=consult'
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_partner_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _subscriber_id uuid;
  _partner_id uuid;
  _partner_user_id uuid;
  _subscriber_name text;
  _partner_name text;
BEGIN
  UPDATE public.partner_chat_conversations
  SET
    last_message_at = NEW.created_at,
    subscriber_unread_count = CASE WHEN NEW.sender_role = 'partner' THEN subscriber_unread_count + 1 ELSE subscriber_unread_count END,
    partner_unread_count = CASE WHEN NEW.sender_role = 'subscriber' THEN partner_unread_count + 1 ELSE partner_unread_count END
  WHERE id = NEW.conversation_id
  RETURNING subscriber_id, partner_id INTO _subscriber_id, _partner_id;

  SELECT cp.user_id, cp.name
    INTO _partner_user_id, _partner_name
  FROM public.channel_partners cp
  WHERE cp.id = _partner_id;

  SELECT COALESCE(NULLIF(trim(p.name), ''), 'Subscriber')
    INTO _subscriber_name
  FROM public.profiles p
  WHERE p.user_id = _subscriber_id;

  IF NEW.sender_role = 'subscriber' AND _partner_user_id IS NOT NULL AND _partner_user_id <> NEW.sender_id THEN
    INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
    VALUES (
      _partner_user_id,
      'New yoga subscriber message',
      COALESCE(_subscriber_name, 'Subscriber') || ': ' || left(trim(NEW.message), 140),
      'chat_message',
      '💬',
      '/partner-dashboard?tab=subscribers'
    );
  ELSIF NEW.sender_role = 'partner' AND _subscriber_id IS NOT NULL AND _subscriber_id <> NEW.sender_id THEN
    INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
    VALUES (
      _subscriber_id,
      'New yoga instructor message',
      COALESCE(_partner_name, 'Your yoga instructor') || ': ' || left(trim(NEW.message), 140),
      'chat_message',
      '💬',
      '/home?tab=videos'
    );
  END IF;

  RETURN NEW;
END;
$function$;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.thyrocare_recommendations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
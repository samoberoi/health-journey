
CREATE OR REPLACE FUNCTION public.seed_onboarding_notifications(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
  _first text;
  _coach text;
  _plan text;
  _has_coach boolean;
  _inserted int := 0;
  _existing int;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;

  -- Only seed once per user
  SELECT COUNT(*) INTO _existing
  FROM public.notifications
  WHERE user_id = _user_id AND type = 'onboarding';
  IF _existing > 0 THEN RETURN 0; END IF;

  SELECT COALESCE(NULLIF(trim(name), ''), 'Champion'),
         COALESCE(coach_name, ''),
         COALESCE(NULLIF(trim(name), ''), 'Champion')
    INTO _name, _coach, _first
  FROM public.profiles WHERE user_id = _user_id LIMIT 1;

  _first := split_part(_first, ' ', 1);
  _has_coach := _coach IS NOT NULL AND length(_coach) > 0;

  SELECT plan_id INTO _plan
  FROM public.subscriptions
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY started_at DESC LIMIT 1;

  -- 1. Program has started
  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (_user_id, '🎉 Your program is live',
          'Welcome ' || _first || '! Your BBDO journey has officially started. Head to Home to see today''s plan.',
          'onboarding', '🎉', '/home');
  _inserted := _inserted + 1;

  -- 2. Coach assignment (if any)
  IF _has_coach THEN
    INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
    VALUES (_user_id, '👋 Meet your coach',
            _coach || ' is now your dedicated coach and will reach out within 24 hours. You can message them anytime from Messages.',
            'onboarding', '👋', '/home?tab=messages');
    _inserted := _inserted + 1;
  END IF;

  -- 3. Complete your profile
  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (_user_id, '📝 Complete your profile',
          'Add your body stats, lifestyle and clinical history so we can personalise your plan. It only takes a minute.',
          'onboarding', '📝', '/home?tab=profile');
  _inserted := _inserted + 1;

  -- 4. First habit / log
  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (_user_id, '💧 Log your first habit',
          'Tap the + button on Home and log your first glass of water, meal or steps to start your streak.',
          'onboarding', '💧', '/home');
  _inserted := _inserted + 1;

  -- 5. Lab tests
  IF _plan IN ('foundation', 'starter') THEN
    INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
    VALUES (_user_id, '🧪 Book your Foundation lab panel',
            'Choose a curated metabolic panel with free home collection. Reports appear right here when ready.',
            'onboarding', '🧪', '/home?tab=labs');
  ELSE
    INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
    VALUES (_user_id, '🧪 Lab tests coming up',
            'Your coach will recommend the exact lab panels for your plan. You''ll be notified as soon as they''re assigned.',
            'onboarding', '🧪', '/home?tab=labs');
  END IF;
  _inserted := _inserted + 1;

  -- 6. Community
  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (_user_id, '💬 Join the community',
          'You''re not alone. Share wins, ask questions and cheer others on inside the BBDO community.',
          'onboarding', '💬', '/home?tab=community');
  _inserted := _inserted + 1;

  -- 7. Yoga upsell
  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (_user_id, '🧘 Add live yoga sessions',
          'Boost stress recovery with live 1:1 or group yoga classes. Check Videos → Upgrade to explore.',
          'onboarding', '🧘', '/home?tab=videos');
  _inserted := _inserted + 1;

  RETURN _inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_onboarding_notifications(uuid) TO authenticated, service_role;

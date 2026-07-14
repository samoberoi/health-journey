CREATE OR REPLACE FUNCTION public.auto_generate_compliment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _prev_weight NUMERIC;
  _prev_glucose NUMERIC;
  _prev_bp NUMERIC;
  _baseline_weight NUMERIC;
  _msg TEXT;
  _emoji TEXT;
  _type TEXT;
  _metric TEXT;
  _user_name TEXT;
  _coach_name TEXT;
  _delta NUMERIC;
  _compliment_id UUID;
BEGIN
  SELECT COALESCE(SPLIT_PART(name, ' ', 1), 'Champion'),
         COALESCE(coach_name, 'Your Coach'),
         weight
  INTO _user_name, _coach_name, _baseline_weight
  FROM public.profiles WHERE user_id = NEW.user_id;

  IF _user_name IS NULL OR _user_name = '' THEN _user_name := 'Champion'; END IF;
  IF _coach_name IS NULL OR _coach_name = '' THEN _coach_name := 'Your Coach'; END IF;

  -- Weight improvement
  IF NEW.log_type = 'weight' AND NEW.weight_kg IS NOT NULL THEN
    SELECT weight_kg INTO _prev_weight FROM public.health_logs
    WHERE user_id = NEW.user_id AND log_type = 'weight' AND weight_kg IS NOT NULL AND id != NEW.id
    ORDER BY logged_at DESC LIMIT 1;

    IF _prev_weight IS NULL THEN
      _prev_weight := _baseline_weight;
    END IF;

    IF _prev_weight IS NOT NULL AND NEW.weight_kg < _prev_weight THEN
      _delta := ROUND((_prev_weight - NEW.weight_kg)::numeric, 1);
      IF _delta > 0 THEN
        _type := 'weight_loss'; _emoji := '🔥';
        _metric := _delta || ' kg lost';
        _msg := _coach_name || ': "' || _user_name || ', you dropped ' || _delta || ' kg! Your discipline is paying off. Keep crushing it! 💪"';

        INSERT INTO public.compliments (user_id, compliment_type, message, emoji, metric_value)
        VALUES (NEW.user_id, _type, _msg, _emoji, _metric) RETURNING id INTO _compliment_id;

        INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
        VALUES (NEW.user_id, '🔥 Weight Drop!', _msg, 'compliment', '🔥', '/dashboard?tab=profile');

        INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
        VALUES (NEW.user_id, '📣 Share your win!', 'You lost ' || _delta || ' kg! Tap to inspire the community 🎉', 'achievement_share', '📣', '/dashboard?tab=community&share=weight_loss&metric=' || _metric);
      END IF;
    END IF;
  END IF;

  -- Glucose improvement
  IF NEW.log_type = 'diabetes' AND NEW.glucose_morning IS NOT NULL THEN
    SELECT glucose_morning INTO _prev_glucose FROM public.health_logs
    WHERE user_id = NEW.user_id AND log_type = 'diabetes' AND glucose_morning IS NOT NULL AND id != NEW.id
    ORDER BY logged_at DESC LIMIT 1;

    IF _prev_glucose IS NOT NULL AND NEW.glucose_morning < _prev_glucose THEN
      _delta := ROUND((_prev_glucose - NEW.glucose_morning)::numeric, 0);
      IF _delta >= 5 THEN
        _type := 'sugar_drop'; _emoji := '🍃';
        _metric := _delta || ' mg/dL drop';
        _msg := _coach_name || ': "' || _user_name || ', your morning sugar dropped by ' || _delta || ' mg/dL! Your body is responding beautifully. 🎉"';

        INSERT INTO public.compliments (user_id, compliment_type, message, emoji, metric_value)
        VALUES (NEW.user_id, _type, _msg, _emoji, _metric);

        INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
        VALUES (NEW.user_id, '🍃 Sugar Improving!', _msg, 'compliment', '🍃', '/dashboard?tab=profile');

        INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
        VALUES (NEW.user_id, '📣 Share your win!', 'Your sugar dropped ' || _delta || ' mg/dL! Tap to share 🎉', 'achievement_share', '📣', '/dashboard?tab=community&share=sugar_drop&metric=' || _metric);
      END IF;
    END IF;
  END IF;

  -- BP improvement
  IF NEW.log_type = 'bp' AND NEW.bp_systolic IS NOT NULL THEN
    SELECT bp_systolic INTO _prev_bp FROM public.health_logs
    WHERE user_id = NEW.user_id AND log_type = 'bp' AND bp_systolic IS NOT NULL AND id != NEW.id
    ORDER BY logged_at DESC LIMIT 1;

    IF _prev_bp IS NOT NULL AND NEW.bp_systolic < _prev_bp THEN
      _delta := ROUND((_prev_bp - NEW.bp_systolic)::numeric, 0);
      IF _delta >= 5 THEN
        _type := 'bp_improvement'; _emoji := '❤️';
        _metric := _delta || ' mmHg drop';
        _msg := _coach_name || ': "' || _user_name || ', your BP is coming down — ' || _delta || ' mmHg better! Your heart thanks you. ❤️"';

        INSERT INTO public.compliments (user_id, compliment_type, message, emoji, metric_value)
        VALUES (NEW.user_id, _type, _msg, _emoji, _metric);

        INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
        VALUES (NEW.user_id, '❤️ BP Getting Better!', _msg, 'compliment', '❤️', '/dashboard?tab=profile');

        INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
        VALUES (NEW.user_id, '📣 Share your win!', 'Your BP dropped ' || _delta || ' mmHg! Tap to share 🎉', 'achievement_share', '📣', '/dashboard?tab=community&share=bp_improvement&metric=' || _metric);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- Compliments table
CREATE TABLE public.compliments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  compliment_type TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🌟',
  metric_value TEXT,
  is_seen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.compliments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own compliments" ON public.compliments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own compliments" ON public.compliments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own compliments" ON public.compliments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "System can insert compliments" ON public.compliments FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view all compliments" ON public.compliments FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Coaches can view patient compliments" ON public.compliments FOR SELECT USING (
  has_role(auth.uid(), 'coach'::app_role) AND EXISTS (
    SELECT 1 FROM coach_assignments ca JOIN coaches c ON c.id = ca.coach_id
    WHERE ca.user_id = compliments.user_id AND ca.is_active = true AND c.user_id = auth.uid()
  )
);

CREATE INDEX idx_compliments_user_id ON public.compliments(user_id);
CREATE INDEX idx_compliments_created_at ON public.compliments(created_at DESC);

-- Function to auto-generate compliments on health log insert
CREATE OR REPLACE FUNCTION public.auto_generate_compliment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prev RECORD;
  _msg TEXT;
  _emoji TEXT;
  _type TEXT;
  _metric TEXT;
  _user_name TEXT;
  _coach_name TEXT;
BEGIN
  -- Get user's first name and coach
  SELECT COALESCE(SPLIT_PART(name, ' ', 1), 'Champion') INTO _user_name FROM public.profiles WHERE user_id = NEW.user_id;
  SELECT COALESCE(coach_name, 'Your Coach') INTO _coach_name FROM public.profiles WHERE user_id = NEW.user_id;
  IF _user_name IS NULL OR _user_name = '' THEN _user_name := 'Champion'; END IF;
  IF _coach_name IS NULL OR _coach_name = '' THEN _coach_name := 'Your Coach'; END IF;

  -- Weight improvement
  IF NEW.log_type = 'weight' AND NEW.weight_kg IS NOT NULL THEN
    SELECT weight_kg INTO _prev FROM public.health_logs
    WHERE user_id = NEW.user_id AND log_type = 'weight' AND weight_kg IS NOT NULL AND id != NEW.id
    ORDER BY logged_at DESC LIMIT 1;

    IF _prev IS NOT NULL AND NEW.weight_kg < _prev.weight_kg THEN
      _type := 'weight_loss';
      _emoji := '🔥';
      _metric := ROUND((_prev.weight_kg - NEW.weight_kg)::numeric, 1) || ' kg lost';
      _msg := _coach_name || ': "' || _user_name || ', you dropped ' || ROUND((_prev.weight_kg - NEW.weight_kg)::numeric, 1) || ' kg! Your discipline is paying off. Keep crushing it! 💪"';

      INSERT INTO public.compliments (user_id, compliment_type, message, emoji, metric_value) VALUES (NEW.user_id, _type, _msg, _emoji, _metric);
      INSERT INTO public.notifications (user_id, title, body, type, icon) VALUES (NEW.user_id, '🔥 Weight Drop!', _msg, 'compliment', '🔥');
    END IF;
  END IF;

  -- Glucose improvement
  IF NEW.log_type = 'diabetes' AND (NEW.glucose_morning IS NOT NULL OR NEW.glucose_evening IS NOT NULL) THEN
    SELECT glucose_morning, glucose_evening INTO _prev FROM public.health_logs
    WHERE user_id = NEW.user_id AND log_type = 'diabetes' AND id != NEW.id
    ORDER BY logged_at DESC LIMIT 1;

    IF _prev IS NOT NULL THEN
      IF NEW.glucose_morning IS NOT NULL AND _prev.glucose_morning IS NOT NULL AND NEW.glucose_morning < _prev.glucose_morning AND _prev.glucose_morning - NEW.glucose_morning >= 5 THEN
        _type := 'sugar_drop';
        _emoji := '🍃';
        _metric := ROUND((_prev.glucose_morning - NEW.glucose_morning)::numeric, 0) || ' mg/dL drop';
        _msg := _coach_name || ': "' || _user_name || ', your morning sugar dropped by ' || ROUND((_prev.glucose_morning - NEW.glucose_morning)::numeric, 0) || ' mg/dL! Your body is responding beautifully. 🎉"';

        INSERT INTO public.compliments (user_id, compliment_type, message, emoji, metric_value) VALUES (NEW.user_id, _type, _msg, _emoji, _metric);
        INSERT INTO public.notifications (user_id, title, body, type, icon) VALUES (NEW.user_id, '🍃 Sugar Improving!', _msg, 'compliment', '🍃');
      END IF;
    END IF;
  END IF;

  -- BP improvement
  IF NEW.log_type = 'bp' AND NEW.bp_systolic IS NOT NULL THEN
    SELECT bp_systolic INTO _prev FROM public.health_logs
    WHERE user_id = NEW.user_id AND log_type = 'bp' AND bp_systolic IS NOT NULL AND id != NEW.id
    ORDER BY logged_at DESC LIMIT 1;

    IF _prev IS NOT NULL AND NEW.bp_systolic < _prev.bp_systolic AND _prev.bp_systolic - NEW.bp_systolic >= 5 THEN
      _type := 'bp_improvement';
      _emoji := '❤️';
      _metric := ROUND((_prev.bp_systolic - NEW.bp_systolic)::numeric, 0) || ' mmHg drop';
      _msg := _coach_name || ': "' || _user_name || ', your BP is coming down — ' || ROUND((_prev.bp_systolic - NEW.bp_systolic)::numeric, 0) || ' mmHg better! Your heart thanks you. ❤️"';

      INSERT INTO public.compliments (user_id, compliment_type, message, emoji, metric_value) VALUES (NEW.user_id, _type, _msg, _emoji, _metric);
      INSERT INTO public.notifications (user_id, title, body, type, icon) VALUES (NEW.user_id, '❤️ BP Getting Better!', _msg, 'compliment', '❤️');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to health_logs
CREATE TRIGGER trg_auto_compliment
AFTER INSERT ON public.health_logs
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_compliment();

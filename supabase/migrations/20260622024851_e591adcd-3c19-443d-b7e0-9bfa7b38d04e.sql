
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.meeting_type AS ENUM ('onboarding','weekly_checkpoint','quarterly_review','consultation','followup');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.meeting_status AS ENUM ('scheduled','completed','cancelled','no_show');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.consultation_status AS ENUM ('pending','scheduled','declined','completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.recommendation_status AS ENUM ('recommended','accepted','ordered','completed','dismissed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============ coach_meetings ============
CREATE TABLE IF NOT EXISTS public.coach_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 30,
  meeting_link text,
  meeting_type public.meeting_type NOT NULL DEFAULT 'followup',
  status public.meeting_status NOT NULL DEFAULT 'scheduled',
  agenda text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_meetings_user ON public.coach_meetings(user_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_meetings_coach ON public.coach_meetings(coach_id, scheduled_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_meetings TO authenticated;
GRANT ALL ON public.coach_meetings TO service_role;
ALTER TABLE public.coach_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients see own meetings" ON public.coach_meetings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "coach sees own meetings" ON public.coach_meetings
  FOR SELECT TO authenticated USING (public.is_coach_of_assignment(coach_id));
CREATE POLICY "admin sees all meetings" ON public.coach_meetings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "coach manages own meetings" ON public.coach_meetings
  FOR ALL TO authenticated
  USING (public.is_coach_of_assignment(coach_id))
  WITH CHECK (public.is_coach_of_assignment(coach_id));
CREATE POLICY "admin manages all meetings" ON public.coach_meetings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_coach_meetings_updated BEFORE UPDATE ON public.coach_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ consultation_requests ============
CREATE TABLE IF NOT EXISTS public.consultation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  coach_id uuid REFERENCES public.coaches(id) ON DELETE SET NULL,
  topic text NOT NULL,
  urgency text NOT NULL DEFAULT 'normal',
  preferred_slots jsonb DEFAULT '[]'::jsonb,
  status public.consultation_status NOT NULL DEFAULT 'pending',
  meeting_id uuid REFERENCES public.coach_meetings(id) ON DELETE SET NULL,
  coach_response text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consult_req_user ON public.consultation_requests(user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_consult_req_coach ON public.consultation_requests(coach_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultation_requests TO authenticated;
GRANT ALL ON public.consultation_requests TO service_role;
ALTER TABLE public.consultation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient manages own requests" ON public.consultation_requests
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "coach sees patient requests" ON public.consultation_requests
  FOR SELECT TO authenticated USING (coach_id IS NOT NULL AND public.is_coach_of_assignment(coach_id));
CREATE POLICY "coach updates patient requests" ON public.consultation_requests
  FOR UPDATE TO authenticated
  USING (coach_id IS NOT NULL AND public.is_coach_of_assignment(coach_id))
  WITH CHECK (coach_id IS NOT NULL AND public.is_coach_of_assignment(coach_id));
CREATE POLICY "admin all consultation" ON public.consultation_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_consult_req_updated BEFORE UPDATE ON public.consultation_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ coach_test_recommendations ============
CREATE TABLE IF NOT EXISTS public.coach_test_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  product_codes text[] NOT NULL DEFAULT '{}',
  note text,
  status public.recommendation_status NOT NULL DEFAULT 'recommended',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ctr_user ON public.coach_test_recommendations(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_test_recommendations TO authenticated;
GRANT ALL ON public.coach_test_recommendations TO service_role;
ALTER TABLE public.coach_test_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient reads own test recs" ON public.coach_test_recommendations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "patient updates own test recs" ON public.coach_test_recommendations
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "coach manages own test recs" ON public.coach_test_recommendations
  FOR ALL TO authenticated
  USING (public.is_coach_of_assignment(coach_id))
  WITH CHECK (public.is_coach_of_assignment(coach_id));
CREATE POLICY "admin all test recs" ON public.coach_test_recommendations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_ctr_updated BEFORE UPDATE ON public.coach_test_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ coach_supplement_recommendations ============
CREATE TABLE IF NOT EXISTS public.coach_supplement_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  status public.recommendation_status NOT NULL DEFAULT 'recommended',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_csr_user ON public.coach_supplement_recommendations(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_supplement_recommendations TO authenticated;
GRANT ALL ON public.coach_supplement_recommendations TO service_role;
ALTER TABLE public.coach_supplement_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient reads own supp recs" ON public.coach_supplement_recommendations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "patient updates own supp recs" ON public.coach_supplement_recommendations
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "coach manages own supp recs" ON public.coach_supplement_recommendations
  FOR ALL TO authenticated
  USING (public.is_coach_of_assignment(coach_id))
  WITH CHECK (public.is_coach_of_assignment(coach_id));
CREATE POLICY "admin all supp recs" ON public.coach_supplement_recommendations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_csr_updated BEFORE UPDATE ON public.coach_supplement_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ diet_platings (30-day plan) ============
CREATE TABLE IF NOT EXISTS public.diet_platings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_start_date date NOT NULL,
  day_index integer NOT NULL CHECK (day_index BETWEEN 0 AND 29),
  meal_slot text NOT NULL,
  plate_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  calories integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_start_date, day_index, meal_slot)
);
CREATE INDEX IF NOT EXISTS idx_diet_platings_user ON public.diet_platings(user_id, plan_start_date, day_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diet_platings TO authenticated;
GRANT ALL ON public.diet_platings TO service_role;
ALTER TABLE public.diet_platings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient reads own platings" ON public.diet_platings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "patient manages own platings" ON public.diet_platings
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "coach reads assigned patient platings" ON public.diet_platings
  FOR SELECT TO authenticated USING (public.coach_owns_patient(user_id));
CREATE POLICY "admin all platings" ON public.diet_platings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ auto generate 30-day diet plating ============
CREATE OR REPLACE FUNCTION public.generate_diet_plating(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _start date := current_date;
  _diet text;
  _is_veg boolean;
  _is_vegan boolean;
  _d integer;
  _count integer := 0;
  _slots text[] := ARRAY['breakfast','lunch','snack','dinner'];
  _slot text;
  _plate jsonb;
  _cal integer;
  _bf jsonb; _ln jsonb; _sn jsonb; _dn jsonb;
BEGIN
  SELECT COALESCE(diet_type,'mixed') INTO _diet
  FROM public.user_diet_profiles WHERE user_id = _user_id
  ORDER BY updated_at DESC NULLS LAST LIMIT 1;
  IF _diet IS NULL THEN _diet := 'mixed'; END IF;
  _is_vegan := _diet ILIKE '%vegan%';
  _is_veg := _is_vegan OR _diet ILIKE '%veg%';

  DELETE FROM public.diet_platings
   WHERE user_id = _user_id AND plan_start_date = _start;

  FOR _d IN 0..29 LOOP
    _bf := CASE WHEN _is_vegan
        THEN jsonb_build_object('title','Oats + chia + berries','items',jsonb_build_array('oats','chia','berries','almond milk'))
        WHEN _is_veg
        THEN jsonb_build_object('title','Veg moong dosa + chutney','items',jsonb_build_array('moong dosa','coconut chutney','curd'))
        ELSE jsonb_build_object('title','3 egg omelette + sourdough','items',jsonb_build_array('eggs','sourdough','greens'))
      END;
    _ln := CASE WHEN _is_vegan
        THEN jsonb_build_object('title','Quinoa bowl + tofu + veg','items',jsonb_build_array('quinoa','tofu','sauteed veg','hummus'))
        WHEN _is_veg
        THEN jsonb_build_object('title','Roti + dal + sabzi + salad','items',jsonb_build_array('roti','dal','sabzi','salad','curd'))
        ELSE jsonb_build_object('title','Chicken + rice + salad','items',jsonb_build_array('grilled chicken','brown rice','salad'))
      END;
    _sn := jsonb_build_object('title','Nuts + fruit','items',jsonb_build_array('almonds','walnuts','apple'));
    _dn := CASE WHEN _is_vegan
        THEN jsonb_build_object('title','Lentil soup + roasted veg','items',jsonb_build_array('lentil soup','roasted veg'))
        WHEN _is_veg
        THEN jsonb_build_object('title','Paneer bhurji + roti','items',jsonb_build_array('paneer bhurji','roti','salad'))
        ELSE jsonb_build_object('title','Grilled fish + veg','items',jsonb_build_array('fish','steamed veg','quinoa'))
      END;

    FOREACH _slot IN ARRAY _slots LOOP
      _plate := CASE _slot
        WHEN 'breakfast' THEN _bf
        WHEN 'lunch' THEN _ln
        WHEN 'snack' THEN _sn
        WHEN 'dinner' THEN _dn
      END;
      _cal := CASE _slot WHEN 'breakfast' THEN 380 WHEN 'lunch' THEN 520 WHEN 'snack' THEN 180 ELSE 460 END;

      INSERT INTO public.diet_platings (user_id, plan_start_date, day_index, meal_slot, plate_data, calories)
      VALUES (_user_id, _start, _d, _slot, _plate, _cal);
      _count := _count + 1;
    END LOOP;
  END LOOP;

  RETURN _count;
END;
$$;

-- ============ on subscription activation: generate diet, notify coach ============
CREATE OR REPLACE FUNCTION public.on_subscription_active_full_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _coach_id uuid;
  _coach_user uuid;
  _patient_name text;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  IF NEW.plan_id NOT IN ('active','intensive','pro') THEN RETURN NEW; END IF;

  -- generate diet plating (idempotent for today's start date)
  PERFORM public.generate_diet_plating(NEW.user_id);

  SELECT ca.coach_id INTO _coach_id
  FROM public.coach_assignments ca
  WHERE ca.user_id = NEW.user_id AND ca.is_active = true
  LIMIT 1;

  IF _coach_id IS NOT NULL THEN
    SELECT user_id INTO _coach_user FROM public.coaches WHERE id = _coach_id;
    SELECT COALESCE(name,'New patient') INTO _patient_name FROM public.profiles WHERE user_id = NEW.user_id;
    IF _coach_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
      VALUES (
        _coach_user,
        'New patient assigned',
        _patient_name || ' just joined the ' || NEW.plan_name || ' plan. Schedule their onboarding meeting.',
        'coach_new_patient', '🩺', '/coach?tab=meetings'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_active_workflow ON public.subscriptions;
CREATE TRIGGER trg_subscription_active_workflow
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.on_subscription_active_full_workflow();

-- ============ notify patient on meeting create/update ============
CREATE OR REPLACE FUNCTION public.notify_patient_on_meeting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _coach_name text;
  _title text;
BEGIN
  SELECT name INTO _coach_name FROM public.coaches WHERE id = NEW.coach_id;
  IF TG_OP = 'INSERT' THEN
    _title := 'Meeting scheduled by ' || COALESCE(_coach_name,'your coach');
  ELSE
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at OR NEW.meeting_link IS DISTINCT FROM OLD.meeting_link THEN
      _title := 'Meeting updated';
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
  VALUES (
    NEW.user_id, _title,
    to_char(NEW.scheduled_at at time zone 'Asia/Kolkata','DD Mon, HH24:MI') || ' IST — ' || COALESCE(NEW.agenda,replace(NEW.meeting_type::text,'_',' ')),
    'meeting', '📅', '/home?tab=consult'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meeting_notify ON public.coach_meetings;
CREATE TRIGGER trg_meeting_notify
  AFTER INSERT OR UPDATE ON public.coach_meetings
  FOR EACH ROW EXECUTE FUNCTION public.notify_patient_on_meeting();

-- ============ notify coach on consultation request ============
CREATE OR REPLACE FUNCTION public.notify_coach_on_consult_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _coach_user uuid;
  _patient_name text;
BEGIN
  IF NEW.coach_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO _coach_user FROM public.coaches WHERE id = NEW.coach_id;
  SELECT COALESCE(name,'A patient') INTO _patient_name FROM public.profiles WHERE user_id = NEW.user_id;
  IF _coach_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, icon, action_url)
    VALUES (
      _coach_user,
      'Consultation requested',
      _patient_name || ' requested a consultation: ' || left(NEW.topic, 120),
      'consultation_request', '🆘', '/coach?tab=requests'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consult_notify ON public.consultation_requests;
CREATE TRIGGER trg_consult_notify
  AFTER INSERT ON public.consultation_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_coach_on_consult_request();

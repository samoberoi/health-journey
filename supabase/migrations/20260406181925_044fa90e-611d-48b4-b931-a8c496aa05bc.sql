
-- Fasting Protocol Master
CREATE TABLE public.fasting_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_name TEXT NOT NULL,
  protocol_type TEXT NOT NULL CHECK (protocol_type IN ('basic', 'moderate', 'severe')),
  total_weeks INTEGER NOT NULL DEFAULT 24,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  remarks TEXT,
  no_calories BOOLEAN NOT NULL DEFAULT true,
  allowed_items TEXT[] NOT NULL DEFAULT ARRAY['Water', 'Lemon water (no salt/sugar)', 'Black coffee', 'Black tea', 'Green tea (no sweeteners)'],
  avoid_items TEXT[] NOT NULL DEFAULT ARRAY['Any calories', 'Sugar', 'Milk', 'Sweeteners', 'Fruit juice'],
  breaking_fast_guide TEXT DEFAULT 'Start with warm water or lemon water. After 15 minutes, have a light meal with protein and healthy fats. Avoid heavy carbs immediately.',
  safety_notes TEXT DEFAULT 'Stop fasting immediately if you experience dizziness, extreme fatigue, heart palpitations, or nausea. Consult your coach.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weekly Plan
CREATE TABLE public.fasting_weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES public.fasting_protocols(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  fasting_pattern TEXT NOT NULL DEFAULT '12:12',
  lmod_time TEXT NOT NULL DEFAULT '19:00',
  fmod_time TEXT NOT NULL DEFAULT '07:00',
  metabolic_push BOOLEAN NOT NULL DEFAULT false,
  push_pattern TEXT,
  push_days INTEGER DEFAULT 0,
  remarks TEXT,
  requires_coach_guidance BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (protocol_id, week_number)
);

-- User Protocol Assignment
CREATE TABLE public.user_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  protocol_id UUID NOT NULL REFERENCES public.fasting_protocols(id),
  assigned_by UUID,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fasting Tracking
CREATE TABLE public.fasting_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  lmod_actual_time TIMESTAMPTZ,
  fmod_actual_time TIMESTAMPTZ,
  fasting_hours_completed NUMERIC(4,1),
  compliance_status TEXT DEFAULT 'pending' CHECK (compliance_status IN ('pending', 'completed', 'missed', 'partial')),
  symptoms_flag BOOLEAN NOT NULL DEFAULT false,
  symptoms_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- Enable RLS
ALTER TABLE public.fasting_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fasting_weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fasting_tracking ENABLE ROW LEVEL SECURITY;

-- fasting_protocols RLS
CREATE POLICY "Authenticated can view active protocols" ON public.fasting_protocols FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage protocols" ON public.fasting_protocols FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert protocols" ON public.fasting_protocols FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

-- fasting_weekly_plans RLS
CREATE POLICY "Authenticated can view weekly plans" ON public.fasting_weekly_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage weekly plans" ON public.fasting_weekly_plans FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert weekly plans" ON public.fasting_weekly_plans FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

-- user_protocols RLS
CREATE POLICY "Users can view own protocol" ON public.user_protocols FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Coaches can view assigned patient protocols" ON public.user_protocols FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'coach') AND EXISTS (
    SELECT 1 FROM coach_assignments ca JOIN coaches c ON c.id = ca.coach_id
    WHERE ca.user_id = user_protocols.user_id AND ca.is_active = true AND c.user_id = auth.uid()
  )
);
CREATE POLICY "Coaches can insert patient protocols" ON public.user_protocols FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'coach') AND EXISTS (
    SELECT 1 FROM coach_assignments ca JOIN coaches c ON c.id = ca.coach_id
    WHERE ca.user_id = user_protocols.user_id AND ca.is_active = true AND c.user_id = auth.uid()
  )
);
CREATE POLICY "Coaches can update patient protocols" ON public.user_protocols FOR UPDATE TO authenticated USING (
  has_role(auth.uid(), 'coach') AND EXISTS (
    SELECT 1 FROM coach_assignments ca JOIN coaches c ON c.id = ca.coach_id
    WHERE ca.user_id = user_protocols.user_id AND ca.is_active = true AND c.user_id = auth.uid()
  )
);
CREATE POLICY "Admins can manage user protocols" ON public.user_protocols FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- fasting_tracking RLS
CREATE POLICY "Users can view own tracking" ON public.fasting_tracking FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tracking" ON public.fasting_tracking FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tracking" ON public.fasting_tracking FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Coaches can view patient tracking" ON public.fasting_tracking FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'coach') AND EXISTS (
    SELECT 1 FROM coach_assignments ca JOIN coaches c ON c.id = ca.coach_id
    WHERE ca.user_id = fasting_tracking.user_id AND ca.is_active = true AND c.user_id = auth.uid()
  )
);
CREATE POLICY "Admins can view all tracking" ON public.fasting_tracking FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER fasting_protocols_updated_at BEFORE UPDATE ON public.fasting_protocols FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER user_protocols_updated_at BEFORE UPDATE ON public.user_protocols FOR EACH ROW EXECUTE FUNCTION update_updated_at();

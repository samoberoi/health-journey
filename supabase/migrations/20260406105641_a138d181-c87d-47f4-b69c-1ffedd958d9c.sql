
-- Coach type enum
CREATE TYPE public.coach_type AS ENUM ('starter_reset', 'active_reset', 'pro_transformation');

-- App role enum
CREATE TYPE public.app_role AS ENUM ('user', 'coach', 'admin');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Coaches table
CREATE TABLE public.coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  specialization TEXT,
  coach_type coach_type NOT NULL,
  years_experience INTEGER NOT NULL DEFAULT 0,
  total_consultations INTEGER NOT NULL DEFAULT 0,
  avg_rating NUMERIC(2,1) NOT NULL DEFAULT 0.0,
  total_ratings INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active coaches" ON public.coaches
  FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Coaches can update own profile" ON public.coaches
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Coach assignments
CREATE TABLE public.coach_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (user_id, coach_id)
);
ALTER TABLE public.coach_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assignments" ON public.coach_assignments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert assignments" ON public.coach_assignments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Coach ratings
CREATE TABLE public.coach_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, coach_id)
);
ALTER TABLE public.coach_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ratings" ON public.coach_ratings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ratings" ON public.coach_ratings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ratings" ON public.coach_ratings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Trigger for updated_at on coaches
CREATE TRIGGER update_coaches_updated_at
  BEFORE UPDATE ON public.coaches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function to auto-assign coach based on plan
CREATE OR REPLACE FUNCTION public.assign_coach_for_plan(_user_id UUID, _plan_id TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _coach_type coach_type;
  _coach_id UUID;
BEGIN
  -- Map plan to coach type
  _coach_type := CASE _plan_id
    WHEN 'starter' THEN 'starter_reset'::coach_type
    WHEN 'active' THEN 'active_reset'::coach_type
    WHEN 'pro' THEN 'pro_transformation'::coach_type
    ELSE 'starter_reset'::coach_type
  END;

  -- Deactivate existing assignments
  UPDATE public.coach_assignments SET is_active = false WHERE user_id = _user_id AND is_active = true;

  -- Pick coach with fewest active assignments (load balancing)
  SELECT c.id INTO _coach_id
  FROM public.coaches c
  LEFT JOIN (
    SELECT coach_id, COUNT(*) as cnt FROM public.coach_assignments WHERE is_active = true GROUP BY coach_id
  ) a ON a.coach_id = c.id
  WHERE c.coach_type = _coach_type AND c.is_active = true
  ORDER BY COALESCE(a.cnt, 0) ASC, c.avg_rating DESC
  LIMIT 1;

  IF _coach_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.coach_assignments (user_id, coach_id, is_active)
  VALUES (_user_id, _coach_id, true)
  ON CONFLICT (user_id, coach_id) DO UPDATE SET is_active = true, assigned_at = now();

  -- Update profile coach_name
  UPDATE public.profiles SET coach_name = (SELECT name FROM public.coaches WHERE id = _coach_id) WHERE user_id = _user_id;

  RETURN _coach_id;
END;
$$;

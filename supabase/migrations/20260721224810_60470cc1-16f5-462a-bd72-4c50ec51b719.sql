
CREATE TABLE IF NOT EXISTS public.user_soleus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  session_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_soleus_sessions TO authenticated;
GRANT ALL ON public.user_soleus_sessions TO service_role;

ALTER TABLE public.user_soleus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own soleus sessions"
  ON public.user_soleus_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own soleus sessions"
  ON public.user_soleus_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own soleus sessions"
  ON public.user_soleus_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_soleus_sessions_user_time
  ON public.user_soleus_sessions (user_id, session_at DESC);

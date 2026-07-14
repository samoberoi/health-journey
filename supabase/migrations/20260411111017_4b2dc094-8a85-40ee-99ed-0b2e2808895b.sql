
-- Chat conversations (one per patient-coach pair)
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  coach_id UUID NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  patient_unread_count INTEGER NOT NULL DEFAULT 0,
  coach_unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (patient_id, coach_id)
);

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'patient',
  message TEXT NOT NULL,
  is_predefined BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_conversations_coach ON public.chat_conversations(coach_id);
CREATE INDEX idx_chat_conversations_patient ON public.chat_conversations(patient_id);

-- RLS on conversations
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own conversations"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = patient_id);

CREATE POLICY "Coaches can view their conversations"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coaches c
    WHERE c.id = chat_conversations.coach_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all conversations"
  ON public.chat_conversations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can insert conversations"
  ON public.chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Participants can update conversations"
  ON public.chat_conversations FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = patient_id
    OR EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = chat_conversations.coach_id AND c.user_id = auth.uid())
  );

-- RLS on messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation participants can view messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_conversations cc
    WHERE cc.id = chat_messages.conversation_id
      AND (
        cc.patient_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = cc.coach_id AND c.user_id = auth.uid())
      )
  ));

CREATE POLICY "Admins can view all messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Conversation participants can send messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations cc
      WHERE cc.id = chat_messages.conversation_id
        AND (
          cc.patient_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = cc.coach_id AND c.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Participants can update messages (read receipts)"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_conversations cc
    WHERE cc.id = chat_messages.conversation_id
      AND (
        cc.patient_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = cc.coach_id AND c.user_id = auth.uid())
      )
  ));

-- Trigger to update last_message_at and unread counts
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_conversations
  SET
    last_message_at = NEW.created_at,
    coach_unread_count = CASE WHEN NEW.sender_role = 'patient' THEN coach_unread_count + 1 ELSE coach_unread_count END,
    patient_unread_count = CASE WHEN NEW.sender_role = 'coach' THEN patient_unread_count + 1 ELSE patient_unread_count END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_message();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;

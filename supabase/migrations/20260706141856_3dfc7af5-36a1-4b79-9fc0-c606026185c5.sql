
-- Conversations
CREATE TABLE public.partner_chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL,
  partner_id uuid NOT NULL REFERENCES public.channel_partners(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  subscriber_unread_count integer NOT NULL DEFAULT 0,
  partner_unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, partner_id)
);
CREATE INDEX idx_pchat_conv_subscriber ON public.partner_chat_conversations(subscriber_id);
CREATE INDEX idx_pchat_conv_partner ON public.partner_chat_conversations(partner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_chat_conversations TO authenticated;
GRANT ALL ON public.partner_chat_conversations TO service_role;

ALTER TABLE public.partner_chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscribers view own partner conversations"
  ON public.partner_chat_conversations FOR SELECT TO authenticated
  USING (auth.uid() = subscriber_id);

CREATE POLICY "Partners view their partner conversations"
  ON public.partner_chat_conversations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.channel_partners cp WHERE cp.id = partner_id AND cp.user_id = auth.uid()));

CREATE POLICY "Admins view all partner conversations"
  ON public.partner_chat_conversations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Subscribers create conversations with booked partner"
  ON public.partner_chat_conversations FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = subscriber_id
    AND EXISTS (
      SELECT 1 FROM public.yoga_bookings yb
      WHERE yb.user_id = auth.uid()
        AND yb.partner_id = partner_chat_conversations.partner_id
    )
  );

CREATE POLICY "Partners create conversations with subscriber"
  ON public.partner_chat_conversations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.channel_partners cp WHERE cp.id = partner_id AND cp.user_id = auth.uid())
  );

CREATE POLICY "Participants update partner conversations"
  ON public.partner_chat_conversations FOR UPDATE TO authenticated
  USING (
    auth.uid() = subscriber_id
    OR EXISTS (SELECT 1 FROM public.channel_partners cp WHERE cp.id = partner_id AND cp.user_id = auth.uid())
  );

CREATE POLICY "Subscribers delete own partner conversations"
  ON public.partner_chat_conversations FOR DELETE TO authenticated
  USING (auth.uid() = subscriber_id);

-- Messages
CREATE TABLE public.partner_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.partner_chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL DEFAULT 'subscriber',
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pchat_msg_conv ON public.partner_chat_messages(conversation_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_chat_messages TO authenticated;
GRANT ALL ON public.partner_chat_messages TO service_role;

ALTER TABLE public.partner_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view partner messages"
  ON public.partner_chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_chat_conversations cc
      WHERE cc.id = conversation_id
        AND (
          cc.subscriber_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.channel_partners cp WHERE cp.id = cc.partner_id AND cp.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Admins view all partner messages"
  ON public.partner_chat_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Participants send partner messages"
  ON public.partner_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.partner_chat_conversations cc
      WHERE cc.id = conversation_id
        AND (
          cc.subscriber_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.channel_partners cp WHERE cp.id = cc.partner_id AND cp.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Participants update partner messages"
  ON public.partner_chat_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_chat_conversations cc
      WHERE cc.id = conversation_id
        AND (
          cc.subscriber_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.channel_partners cp WHERE cp.id = cc.partner_id AND cp.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Senders delete own partner messages"
  ON public.partner_chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- Trigger to update conversation on new message
CREATE OR REPLACE FUNCTION public.update_partner_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.partner_chat_conversations
  SET
    last_message_at = NEW.created_at,
    subscriber_unread_count = CASE WHEN NEW.sender_role = 'partner' THEN subscriber_unread_count + 1 ELSE subscriber_unread_count END,
    partner_unread_count = CASE WHEN NEW.sender_role = 'subscriber' THEN partner_unread_count + 1 ELSE partner_unread_count END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_partner_conversation_on_message
AFTER INSERT ON public.partner_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.update_partner_conversation_on_message();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_chat_messages;

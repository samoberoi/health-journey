
CREATE POLICY "Coaches can insert conversations"
ON public.chat_conversations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.coaches c
    WHERE c.id = chat_conversations.coach_id
    AND c.user_id = auth.uid()
  )
);

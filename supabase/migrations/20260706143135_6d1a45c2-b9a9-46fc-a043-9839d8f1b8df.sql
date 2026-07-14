REVOKE ALL ON FUNCTION public.update_conversation_on_message() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_conversation_on_message() FROM anon;
REVOKE ALL ON FUNCTION public.update_conversation_on_message() FROM authenticated;
REVOKE ALL ON FUNCTION public.update_partner_conversation_on_message() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_partner_conversation_on_message() FROM anon;
REVOKE ALL ON FUNCTION public.update_partner_conversation_on_message() FROM authenticated;
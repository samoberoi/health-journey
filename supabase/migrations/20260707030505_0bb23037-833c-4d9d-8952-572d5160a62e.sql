REVOKE ALL ON FUNCTION public.is_patient_notification_recipient(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_patient_notification_recipient(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_patient_notification_recipient(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.is_patient_notification_recipient(uuid) FROM sandbox_exec;
GRANT EXECUTE ON FUNCTION public.is_patient_notification_recipient(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.guard_patient_facing_notifications() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_patient_facing_notifications() FROM anon;
REVOKE ALL ON FUNCTION public.guard_patient_facing_notifications() FROM authenticated;
REVOKE ALL ON FUNCTION public.guard_patient_facing_notifications() FROM sandbox_exec;

REVOKE ALL ON FUNCTION public.notify_consultation_request_to_coach() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_consultation_request_to_coach() FROM anon;
REVOKE ALL ON FUNCTION public.notify_consultation_request_to_coach() FROM authenticated;
REVOKE ALL ON FUNCTION public.notify_consultation_request_to_coach() FROM sandbox_exec;
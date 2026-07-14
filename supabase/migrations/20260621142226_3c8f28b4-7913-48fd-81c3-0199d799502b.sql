CREATE OR REPLACE FUNCTION public.current_user_package_key(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE s.plan_id
    WHEN 'starter' THEN 'foundation'
    WHEN 'pro' THEN 'intensive'
    ELSE s.plan_id
  END
  FROM public.subscriptions s
  WHERE s.user_id = _user_id
    AND s.status = 'active'
    AND s.expires_at > now()
  ORDER BY s.started_at DESC
  LIMIT 1;
$function$;
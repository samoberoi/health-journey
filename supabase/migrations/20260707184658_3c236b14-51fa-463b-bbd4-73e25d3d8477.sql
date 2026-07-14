
CREATE OR REPLACE FUNCTION public.trg_refresh_gamification()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _row jsonb := to_jsonb(NEW);
  _uid uuid;
  _d date;
BEGIN
  _uid := NULLIF(_row->>'user_id','')::uuid;
  IF _uid IS NULL THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'fasting_tracking' THEN
    _d := (_row->>'date')::date;
  ELSIF TG_TABLE_NAME = 'user_supplement_tracking' THEN
    _d := (_row->>'date')::date;
  ELSIF TG_TABLE_NAME = 'user_exercise_logs' THEN
    _d := (_row->>'logged_at')::timestamptz::date;
  ELSIF TG_TABLE_NAME = 'health_logs' THEN
    _d := (_row->>'logged_at')::timestamptz::date;
  ELSIF TG_TABLE_NAME = 'user_movement_weekly' THEN
    _d := (_row->>'week_start')::date;
  ELSE
    _d := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  END IF;

  PERFORM public.refresh_gamification_for_user(_uid, _d);
  RETURN NEW;
END;
$$;

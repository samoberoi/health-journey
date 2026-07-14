CREATE OR REPLACE FUNCTION public.build_bbdo_snapshot(_user_id uuid, _start date, _end date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _w_start numeric; _w_end numeric;
  _g_start numeric; _g_end numeric;
  _sys_start numeric; _sys_end numeric;
  _dia_start numeric; _dia_end numeric;
  _steps int := 0; _water numeric := 0; _ex_min int := 0;
  _yoga_min int := 0; _supp int := 0; _fast_hrs numeric := 0;
  _complete_days int := 0;
BEGIN
  SELECT weight_kg INTO _w_start FROM public.health_logs
    WHERE user_id=_user_id AND log_type='weight' AND weight_kg IS NOT NULL
      AND logged_at::date >= _start AND logged_at::date <= _end
    ORDER BY logged_at ASC LIMIT 1;
  SELECT weight_kg INTO _w_end FROM public.health_logs
    WHERE user_id=_user_id AND log_type='weight' AND weight_kg IS NOT NULL
      AND logged_at::date >= _start AND logged_at::date <= _end
    ORDER BY logged_at DESC LIMIT 1;

  SELECT glucose_morning INTO _g_start FROM public.health_logs
    WHERE user_id=_user_id AND log_type='diabetes' AND glucose_morning IS NOT NULL
      AND logged_at::date >= _start AND logged_at::date <= _end
    ORDER BY logged_at ASC LIMIT 1;
  SELECT glucose_morning INTO _g_end FROM public.health_logs
    WHERE user_id=_user_id AND log_type='diabetes' AND glucose_morning IS NOT NULL
      AND logged_at::date >= _start AND logged_at::date <= _end
    ORDER BY logged_at DESC LIMIT 1;

  SELECT bp_systolic, bp_diastolic INTO _sys_start, _dia_start FROM public.health_logs
    WHERE user_id=_user_id AND log_type='bp' AND bp_systolic IS NOT NULL
      AND logged_at::date >= _start AND logged_at::date <= _end
    ORDER BY logged_at ASC LIMIT 1;
  SELECT bp_systolic, bp_diastolic INTO _sys_end, _dia_end FROM public.health_logs
    WHERE user_id=_user_id AND log_type='bp' AND bp_systolic IS NOT NULL
      AND logged_at::date >= _start AND logged_at::date <= _end
    ORDER BY logged_at DESC LIMIT 1;

  SELECT
    COALESCE(SUM((snapshot->>'steps')::int),0),
    COALESCE(SUM((snapshot->>'water_glasses')::numeric),0),
    COALESCE(SUM(COALESCE((snapshot->>'exercise_min')::int, (snapshot->>'exercise_completed')::int * 15, 0)),0),
    COALESCE(SUM((snapshot->>'yoga_min')::int),0),
    COALESCE(SUM(COALESCE((snapshot->>'supplements_taken')::int, (snapshot->>'supp_taken')::int, 0)),0),
    COALESCE(SUM((snapshot->>'fasting_hours')::numeric),0),
    COALESCE(SUM(CASE WHEN all_complete THEN 1 ELSE 0 END),0)
  INTO _steps,_water,_ex_min,_yoga_min,_supp,_fast_hrs,_complete_days
  FROM public.user_global_streak_days
  WHERE user_id=_user_id AND day BETWEEN _start AND _end;

  RETURN jsonb_build_object(
    'weight_start', _w_start, 'weight_end', _w_end,
    'glucose_start', _g_start, 'glucose_end', _g_end,
    'bp_systolic_start', _sys_start, 'bp_systolic_end', _sys_end,
    'bp_diastolic_start', _dia_start, 'bp_diastolic_end', _dia_end,
    'total_steps', _steps,
    'total_water_glasses', _water,
    'total_exercise_min', _ex_min,
    'total_yoga_min', _yoga_min,
    'total_supplements', _supp,
    'total_fasting_hours', _fast_hrs,
    'complete_days', _complete_days
  );
END;
$function$;
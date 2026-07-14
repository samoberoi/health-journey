
-- Reset LMOD for test user today
UPDATE fasting_tracking 
SET lmod_actual_time = NULL, compliance_status = 'pending', fasting_hours_completed = NULL
WHERE user_id = '025ccd4e-5106-40fc-bf64-b1c97e3a452e' AND date = CURRENT_DATE;

-- Delete LMOD meal photos for today
DELETE FROM meal_photos 
WHERE user_id = '025ccd4e-5106-40fc-bf64-b1c97e3a452e' 
AND meal_type = 'lmod' 
AND logged_at::date = CURRENT_DATE;


ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS working_hours_start time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS working_hours_end   time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS working_timezone    text NOT NULL DEFAULT 'Asia/Kolkata';

UPDATE public.coaches
   SET working_hours_start = '09:00',
       working_hours_end   = '18:00',
       working_timezone    = 'Asia/Kolkata';

UPDATE public.coaches
   SET working_hours_start = '09:00',
       working_hours_end   = '10:00',
       working_timezone    = 'Asia/Kolkata'
 WHERE name = 'Coach Ankit Verma';

UPDATE public.coaches
   SET phone = '9220421100'
 WHERE name = 'Coach Siddharth Joshi';

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.yoga_bookings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
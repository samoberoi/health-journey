
-- Create meal_photos table
CREATE TABLE public.meal_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  fasting_tracking_id UUID REFERENCES public.fasting_tracking(id),
  meal_type TEXT NOT NULL DEFAULT 'fmod',
  photo_url TEXT NOT NULL,
  estimated_calories INTEGER,
  food_items JSONB DEFAULT '[]'::jsonb,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meal_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own meal photos"
  ON public.meal_photos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal photos"
  ON public.meal_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal photos"
  ON public.meal_photos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all meal photos"
  ON public.meal_photos FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coaches can view patient meal photos"
  ON public.meal_photos FOR SELECT
  USING (
    has_role(auth.uid(), 'coach'::app_role) AND
    EXISTS (
      SELECT 1 FROM coach_assignments ca
      JOIN coaches c ON c.id = ca.coach_id
      WHERE ca.user_id = meal_photos.user_id
        AND ca.is_active = true
        AND c.user_id = auth.uid()
    )
  );

-- Storage bucket for meal photos
INSERT INTO storage.buckets (id, name, public) VALUES ('meal-photos', 'meal-photos', true);

-- Storage policies
CREATE POLICY "Users can upload own meal photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view meal photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'meal-photos');

CREATE POLICY "Users can delete own meal photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

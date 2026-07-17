
CREATE POLICY "Admins can read food-images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'food-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert food-images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'food-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update food-images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'food-images' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'food-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete food-images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'food-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view food-images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'food-images');

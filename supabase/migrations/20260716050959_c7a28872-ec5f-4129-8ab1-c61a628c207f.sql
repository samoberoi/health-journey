
CREATE POLICY "Public read condition icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'condition-icons');

CREATE POLICY "Admins upload condition icons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'condition-icons' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update condition icons"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'condition-icons' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete condition icons"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'condition-icons' AND public.has_role(auth.uid(), 'admin'));

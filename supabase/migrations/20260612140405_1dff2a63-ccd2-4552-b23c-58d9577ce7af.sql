
-- food-images: read for any authenticated user; writes only via service_role (edge function)
CREATE POLICY "Authenticated can read food images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'food-images');

-- plate-snapshots: per-user folder model: {user_id}/{plate_id}.png
CREATE POLICY "Users can read own plate snapshots"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'plate-snapshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload own plate snapshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'plate-snapshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own plate snapshots"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'plate-snapshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own plate snapshots"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'plate-snapshots' AND (storage.foldername(name))[1] = auth.uid()::text);

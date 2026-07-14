
CREATE POLICY "Authenticated can read community images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'community-images');

CREATE POLICY "Users can upload community images to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'community-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own community images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'community-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


-- Add document URL columns to coaches
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS aadhaar_doc_url text;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS pan_doc_url text;

-- Create storage bucket for coach documents
INSERT INTO storage.buckets (id, name, public) VALUES ('coach-documents', 'coach-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Coaches can upload their own documents
CREATE POLICY "Coaches can upload own documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'coach-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Coaches can view their own documents
CREATE POLICY "Coaches can view own documents" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'coach-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Coaches can update their own documents
CREATE POLICY "Coaches can update own documents" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'coach-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Coaches can delete their own documents
CREATE POLICY "Coaches can delete own documents" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'coach-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

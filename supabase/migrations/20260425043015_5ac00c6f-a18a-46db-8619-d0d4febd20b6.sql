
UPDATE storage.buckets SET public = false WHERE id IN ('pdfs','audios','images');

DROP POLICY IF EXISTS "Public read pdfs objects" ON storage.objects;
DROP POLICY IF EXISTS "Public read audios objects" ON storage.objects;
DROP POLICY IF EXISTS "Public read images objects" ON storage.objects;

-- Authenticated AND anon can read via signed URL flow. With private buckets,
-- signed URLs bypass RLS via service role on the storage server. We still
-- allow authenticated SELECT for direct access (e.g. owners listing their own).
CREATE POLICY "Owners or admins can read objects"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('pdfs','audios','images')
  AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin'))
);

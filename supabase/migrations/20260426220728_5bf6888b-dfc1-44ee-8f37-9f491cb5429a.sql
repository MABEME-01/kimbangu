-- Allow public (anon + auth) to read storage objects belonging to approved tracks
DROP POLICY IF EXISTS "Owners or admins can read objects" ON storage.objects;

CREATE POLICY "Public can read approved track files"
ON storage.objects FOR SELECT
USING (
  bucket_id = ANY (ARRAY['pdfs'::text, 'audios'::text, 'images'::text])
  AND (
    -- Owner or admin always
    owner = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    -- Or the file is referenced by an approved track
    OR EXISTS (
      SELECT 1 FROM public.tracks t
      WHERE t.status = 'approved'
        AND (
          t.pdf_path = storage.objects.name
          OR t.audio_path = storage.objects.name
          OR storage.objects.name = ANY (t.image_paths)
        )
    )
  )
);

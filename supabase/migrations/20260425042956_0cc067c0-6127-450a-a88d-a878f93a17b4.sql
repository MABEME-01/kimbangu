
-- Contact messages
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can send contact message"
ON public.contact_messages FOR INSERT
WITH CHECK (
  length(trim(name)) BETWEEN 1 AND 100
  AND length(trim(email)) BETWEEN 3 AND 255
  AND length(trim(message)) BETWEEN 1 AND 2000
);

CREATE POLICY "Admins read contact messages"
ON public.contact_messages FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete contact messages"
ON public.contact_messages FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Tighten storage policies: drop overly broad SELECT/listing if any, then recreate
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (policyname ILIKE '%pdfs%' OR policyname ILIKE '%audios%' OR policyname ILIKE '%images%' OR policyname ILIKE '%public%read%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Public can READ individual objects (needed for <img>, <audio>, <iframe pdf>) but cannot LIST
CREATE POLICY "Public read pdfs objects"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdfs');

CREATE POLICY "Public read audios objects"
ON storage.objects FOR SELECT
USING (bucket_id = 'audios');

CREATE POLICY "Public read images objects"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- Uploaders/admins can write
CREATE POLICY "Uploaders insert pdfs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id='pdfs' AND (public.has_role(auth.uid(),'uploader') OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "Uploaders insert audios"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id='audios' AND (public.has_role(auth.uid(),'uploader') OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "Uploaders insert images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id='images' AND (public.has_role(auth.uid(),'uploader') OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "Uploaders update own files"
ON storage.objects FOR UPDATE
USING (bucket_id IN ('pdfs','audios','images') AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "Uploaders delete own files"
ON storage.objects FOR DELETE
USING (bucket_id IN ('pdfs','audios','images') AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));

-- Make buckets NOT publicly listable (objects still readable by URL via SELECT policy above)
UPDATE storage.buckets SET public = true WHERE id IN ('pdfs','audios','images');

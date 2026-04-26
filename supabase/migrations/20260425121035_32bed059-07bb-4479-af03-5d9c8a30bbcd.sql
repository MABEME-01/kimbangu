DROP POLICY IF EXISTS "Anyone can send contact message" ON public.contact_messages;

CREATE POLICY "Anyone can send contact message"
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(trim(name)) BETWEEN 1 AND 100
    AND length(trim(message)) BETWEEN 1 AND 2000
    AND (email IS NULL OR length(trim(email)) <= 255)
  );
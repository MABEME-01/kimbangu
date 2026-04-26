-- Add read status
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON public.contact_messages (created_at DESC);

-- Fix INSERT policy: email is now optional (form only has name + message)
DROP POLICY IF EXISTS "Anyone can send contact message" ON public.contact_messages;
CREATE POLICY "Anyone can send contact message"
  ON public.contact_messages FOR INSERT
  WITH CHECK (
    length(trim(name)) BETWEEN 1 AND 100
    AND length(trim(message)) BETWEEN 1 AND 2000
    AND (email IS NULL OR length(trim(email)) <= 255)
  );

-- Allow admins to update (mark as read/unread)
DROP POLICY IF EXISTS "Admins update contact messages" ON public.contact_messages;
CREATE POLICY "Admins update contact messages"
  ON public.contact_messages FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Make email column nullable
ALTER TABLE public.contact_messages ALTER COLUMN email DROP NOT NULL;
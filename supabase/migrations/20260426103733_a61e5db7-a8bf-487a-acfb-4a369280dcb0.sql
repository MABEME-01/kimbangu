ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.tracks
  DROP CONSTRAINT IF EXISTS tracks_status_check;

ALTER TABLE public.tracks
  ADD CONSTRAINT tracks_status_check
  CHECK (status IN ('pending','approved','rejected'));

-- Backfill: existing rows become approved so they don't disappear
UPDATE public.tracks SET status = 'approved' WHERE status = 'pending';

-- Replace public SELECT policy
DROP POLICY IF EXISTS "Tracks readable by everyone" ON public.tracks;

CREATE POLICY "Approved tracks readable by everyone"
  ON public.tracks
  FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Owners read own tracks"
  ON public.tracks
  FOR SELECT
  USING (uploaded_by = auth.uid());

CREATE POLICY "Admins read all tracks"
  ON public.tracks
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
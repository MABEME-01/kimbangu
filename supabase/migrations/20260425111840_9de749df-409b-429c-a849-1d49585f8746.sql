ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS author text;
CREATE INDEX IF NOT EXISTS idx_tracks_author ON public.tracks (author);
-- 1) Create categories table
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Seed with current categories
INSERT INTO public.categories (value, label) VALUES
  ('adoracao', 'Adoração a Deus'),
  ('alegria', 'Alegria'),
  ('alertas', 'Alertas de Deus'),
  ('casamento', 'Casamento'),
  ('generativas', 'Generativas / Históricas'),
  ('louvor', 'Louvor a Deus'),
  ('morte', 'Morte'),
  ('reflexao', 'Reflexão'),
  ('suplicas', 'Súplicas ao Senhor');

-- 3) Enable RLS on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read categories"
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage categories"
  ON public.categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Convert tracks.category from enum to text + FK
ALTER TABLE public.tracks
  ALTER COLUMN category TYPE text USING category::text;

ALTER TABLE public.tracks
  ADD CONSTRAINT tracks_category_fkey
  FOREIGN KEY (category) REFERENCES public.categories(value)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- 5) Drop old enum (no longer referenced)
DROP TYPE IF EXISTS public.music_category;

-- 6) New columns on tracks
ALTER TABLE public.tracks
  ADD COLUMN allow_download boolean NOT NULL DEFAULT true,
  ADD COLUMN rejection_reason text;

-- 7) Index for category lookups
CREATE INDEX IF NOT EXISTS idx_tracks_category ON public.tracks(category);
CREATE INDEX IF NOT EXISTS idx_tracks_status ON public.tracks(status);
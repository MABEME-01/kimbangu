
-- 1. Counters on tracks
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS play_count integer NOT NULL DEFAULT 0;

-- 2. Track change history (text-only log)
CREATE TABLE IF NOT EXISTS public.track_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  changed_by uuid,
  changed_by_name text,
  field text NOT NULL,
  old_value text,
  new_value text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_track_history_track ON public.track_history(track_id, created_at DESC);

ALTER TABLE public.track_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "History readable by owner or admin" ON public.track_history;
CREATE POLICY "History readable by owner or admin"
ON public.track_history FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tracks t WHERE t.id = track_history.track_id AND t.uploaded_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.tracks t WHERE t.id = track_history.track_id AND t.status = 'approved')
);

-- Inserts come from triggers (security definer); also allow direct insert by owner/admin defensively
DROP POLICY IF EXISTS "History insertable by owner or admin" ON public.track_history;
CREATE POLICY "History insertable by owner or admin"
ON public.track_history FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.tracks t WHERE t.id = track_history.track_id AND t.uploaded_by = auth.uid())
);

-- 3. Trigger to auto-log changes on tracks
CREATE OR REPLACE FUNCTION public.log_track_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_name text;
BEGIN
  -- Get display name of actor (best-effort)
  SELECT COALESCE(display_name, email) INTO actor_name FROM public.profiles WHERE id = actor;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.track_history(track_id, changed_by, changed_by_name, field, old_value, new_value, note)
    VALUES (NEW.id, actor, actor_name, 'created', NULL, NEW.title, 'Hino criado');
    RETURN NEW;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title THEN
    INSERT INTO public.track_history(track_id, changed_by, changed_by_name, field, old_value, new_value)
    VALUES (NEW.id, actor, actor_name, 'title', OLD.title, NEW.title);
  END IF;
  IF NEW.author IS DISTINCT FROM OLD.author THEN
    INSERT INTO public.track_history(track_id, changed_by, changed_by_name, field, old_value, new_value)
    VALUES (NEW.id, actor, actor_name, 'author', OLD.author, NEW.author);
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    INSERT INTO public.track_history(track_id, changed_by, changed_by_name, field, old_value, new_value)
    VALUES (NEW.id, actor, actor_name, 'description', OLD.description, NEW.description);
  END IF;
  IF NEW.category IS DISTINCT FROM OLD.category THEN
    INSERT INTO public.track_history(track_id, changed_by, changed_by_name, field, old_value, new_value)
    VALUES (NEW.id, actor, actor_name, 'category', OLD.category, NEW.category);
  END IF;
  IF NEW.allow_download IS DISTINCT FROM OLD.allow_download THEN
    INSERT INTO public.track_history(track_id, changed_by, changed_by_name, field, old_value, new_value)
    VALUES (NEW.id, actor, actor_name, 'allow_download', OLD.allow_download::text, NEW.allow_download::text);
  END IF;
  IF NEW.pdf_path IS DISTINCT FROM OLD.pdf_path THEN
    INSERT INTO public.track_history(track_id, changed_by, changed_by_name, field, old_value, new_value)
    VALUES (NEW.id, actor, actor_name, 'pdf', OLD.pdf_path, NEW.pdf_path);
  END IF;
  IF NEW.audio_path IS DISTINCT FROM OLD.audio_path THEN
    INSERT INTO public.track_history(track_id, changed_by, changed_by_name, field, old_value, new_value)
    VALUES (NEW.id, actor, actor_name, 'audio', OLD.audio_path, NEW.audio_path);
  END IF;
  IF NEW.image_paths IS DISTINCT FROM OLD.image_paths THEN
    INSERT INTO public.track_history(track_id, changed_by, changed_by_name, field, old_value, new_value)
    VALUES (NEW.id, actor, actor_name, 'images', array_length(OLD.image_paths,1)::text, array_length(NEW.image_paths,1)::text);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.track_history(track_id, changed_by, changed_by_name, field, old_value, new_value, note)
    VALUES (NEW.id, actor, actor_name, 'status', OLD.status, NEW.status, NEW.rejection_reason);
  ELSIF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    INSERT INTO public.track_history(track_id, changed_by, changed_by_name, field, old_value, new_value)
    VALUES (NEW.id, actor, actor_name, 'rejection_reason', OLD.rejection_reason, NEW.rejection_reason);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_track_insert ON public.tracks;
CREATE TRIGGER trg_log_track_insert
AFTER INSERT ON public.tracks
FOR EACH ROW EXECUTE FUNCTION public.log_track_changes();

DROP TRIGGER IF EXISTS trg_log_track_update ON public.tracks;
CREATE TRIGGER trg_log_track_update
AFTER UPDATE ON public.tracks
FOR EACH ROW EXECUTE FUNCTION public.log_track_changes();

-- 4. RPCs to increment counters atomically (security definer; bypass column-level constraints)
CREATE OR REPLACE FUNCTION public.increment_track_view(_track_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tracks SET view_count = view_count + 1
  WHERE id = _track_id AND status = 'approved';
$$;

CREATE OR REPLACE FUNCTION public.increment_track_download(_track_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tracks SET download_count = download_count + 1
  WHERE id = _track_id AND status = 'approved';
$$;

CREATE OR REPLACE FUNCTION public.increment_track_play(_track_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tracks SET play_count = play_count + 1
  WHERE id = _track_id AND status = 'approved';
$$;

GRANT EXECUTE ON FUNCTION public.increment_track_view(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_track_download(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_track_play(uuid) TO anon, authenticated;

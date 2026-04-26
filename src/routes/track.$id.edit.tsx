import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/app/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCategories } from "@/lib/categories";
import { getSignedUrl, deleteStorageObject } from "@/lib/storage";
import { toast } from "sonner";
import { ArrowLeft, FileText, Music as MusicIcon, Image as ImgIcon, Trash2, Upload as UploadIcon, X } from "lucide-react";

export const Route = createFileRoute("/track/$id/edit")({
  component: EditTrackPage,
});

const MAX_PDF = 25 * 1024 * 1024;
const MAX_AUDIO = 30 * 1024 * 1024;
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_IMAGES = 10;
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_AUDIO = ["audio/mpeg", "audio/mp3"];

const AUTHOR_VALID_RE = /^[\\p{L}][\\p{L}\\p{M}\\s.'\\-]*[\\p{L}.]?$/u;
const metaSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório").max(200),
  author: z.string().trim().max(150).refine((v) => v === "" || AUTHOR_VALID_RE.test(v), { message: "Autor inválido" }).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  category: z.string().min(1, "Categoria obrigatória"),
});

function safeName(name: string) { return name.replace(/[^\\w.\\-]+/g, "_").slice(0, 120); }
const normalizeSpaces = (s: string) => s.replace(/\\s+/g, " ").trim();

type Track = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  category: string;
  pdf_path: string;
  audio_path: string | null;
  image_paths: string[];
  uploaded_by: string | null;
  status: string;
  allow_download: boolean;
};

function EditTrackPage() {
  const { id } = Route.useParams();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { categories } = useCategories();

  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [allowDownload, setAllowDownload] = useState(true);

  // File state
  const [newPdf, setNewPdf] = useState<File | null>(null);
  const [newAudio, setNewAudio] = useState<File | null>(null);
  const [removeAudio, setRemoveAudio] = useState(false);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [keptImages, setKeptImages] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("tracks").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      const t = data as Track | null;
      setTrack(t);
      if (t) {
        setTitle(t.title);
        setAuthor(t.author ?? "");
        setDescription(t.description ?? "");
        setCategory(t.category);
        setAllowDownload(t.allow_download);
        setKeptImages(t.image_paths);
        Promise.all(t.image_paths.map((p) => getSignedUrl("images", p).then((u) => [p, u] as const)))
          .then((entries) => {
            const map: Record<string, string> = {};
            entries.forEach(([p, u]) => { if (u) map[p] = u; });
            setImageUrls(map);
          });
      }
      setLoading(false);
    });
  }, [id]);

  if (authLoading || loading) {
    return <div className="min-h-screen bg-background"><Header /><p className="container mx-auto p-8 text-muted-foreground">A carregar...</p></div>;
  }

  if (!track) {
    return <div className="min-h-screen bg-background"><Header /><p className="container mx-auto p-8">Não encontrado.</p></div>;
  }

  const isOwner = !!user && user.id === track.uploaded_by;
  const canEdit = isAdmin || isOwner;
  if (!canEdit) {
    return <div className="min-h-screen bg-background"><Header /><p className="container mx-auto p-8">Sem permissão.</p></div>;
  }

  const onPickPdf = (f: File | null) => {
    if (!f) { setNewPdf(null); return; }
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return toast.error("Deve ser PDF.");
    if (f.size > MAX_PDF) return toast.error("PDF excede 25 MB.");
    setNewPdf(f);
  };
  const onPickAudio = (f: File | null) => {
    if (!f) { setNewAudio(null); return; }
    if (!ALLOWED_AUDIO.includes(f.type) && !f.name.toLowerCase().endsWith(".mp3")) return toast.error("Áudio deve ser MP3.");
    if (f.size > MAX_AUDIO) return toast.error("Áudio excede 30 MB.");
    setNewAudio(f);
    setRemoveAudio(false);
  };
  const onPickImages = (files: File[]) => {
    if (files.length === 0) { setNewImages([]); return; }
    if (keptImages.length + files.length > MAX_IMAGES) return toast.error(`Máximo ${MAX_IMAGES} imagens no total.`);
    for (const img of files) {
      if (!ALLOWED_IMAGE.includes(img.type)) return toast.error(`'${img.name}': formato não suportado.`);
      if (img.size > MAX_IMAGE) return toast.error(`'${img.name}' excede 8 MB.`);
    }
    setNewImages(files);
  };

  const removeKeptImage = (path: string) => {
    setKeptImages((prev) => prev.filter((p) => p !== path));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const meta = metaSchema.safeParse({
      title: normalizeSpaces(title),
      author: normalizeSpaces(author),
      description: description.trim(),
      category,
    });
    if (!meta.success) return toast.error(meta.error.issues[0].message);

    setSaving(true);
    try {
      const stamp = Date.now();
      const baseDir = `${track.uploaded_by ?? user!.id}/${stamp}`;

      // PDF — replace
      let newPdfPath = track.pdf_path;
      if (newPdf) {
        newPdfPath = `${baseDir}/${safeName(newPdf.name)}`;
        const { error } = await supabase.storage.from("pdfs").upload(newPdfPath, newPdf, { contentType: "application/pdf" });
        if (error) throw error;
      }

      // Audio
      let newAudioPath: string | null = track.audio_path;
      if (removeAudio && !newAudio) {
        newAudioPath = null;
      }
      if (newAudio) {
        newAudioPath = `${baseDir}/${safeName(newAudio.name)}`;
        const { error } = await supabase.storage.from("audios").upload(newAudioPath, newAudio, { contentType: newAudio.type || "audio/mpeg" });
        if (error) throw error;
      }

      // Images: kept + new
      const addedImagePaths: string[] = [];
      for (const img of newImages) {
        const p = `${baseDir}/${safeName(img.name)}`;
        const { error } = await supabase.storage.from("images").upload(p, img, { contentType: img.type });
        if (error) throw error;
        addedImagePaths.push(p);
      }
      const finalImagePaths = [...keptImages, ...addedImagePaths];

      // When uploader edits a rejected/approved track, reset to pending (admin re-review). Admin keeps current status.
      const newStatus = isAdmin ? track.status : "pending";

      const { error: updErr } = await supabase
        .from("tracks")
        .update({
          title: meta.data.title,
          author: meta.data.author || null,
          description: meta.data.description || null,
          category: meta.data.category,
          pdf_path: newPdfPath,
          audio_path: newAudioPath,
          image_paths: finalImagePaths,
          allow_download: allowDownload,
          status: newStatus,
          rejection_reason: newStatus === "pending" ? null : undefined,
        })
        .eq("id", track.id);
      if (updErr) throw updErr;

      // Cleanup old storage objects
      const cleanups: Promise<void>[] = [];
      if (newPdf && track.pdf_path !== newPdfPath) cleanups.push(deleteStorageObject("pdfs", track.pdf_path));
      if (track.audio_path && newAudioPath !== track.audio_path) cleanups.push(deleteStorageObject("audios", track.audio_path));
      const removedImages = track.image_paths.filter((p) => !keptImages.includes(p));
      removedImages.forEach((p) => cleanups.push(deleteStorageObject("images", p)));
      await Promise.allSettled(cleanups);

      toast.success(isAdmin ? "Alterações guardadas." : "Alterações guardadas. Aguardando nova aprovação.");
      navigate({ to: "/track/$id", params: { id: track.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/track/$id" params={{ id: track.id }}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Link>
        </Button>

        <Card className="border-2 border-primary/40">
          <CardHeader><CardTitle>Editar conteúdo</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-5">
              <div>
                <Label className="font-semibold">Título *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
              </div>
              <div>
                <Label className="font-semibold">Autor</Label>
                <Input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={150} />
              </div>
              <div>
                <Label className="font-semibold">Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
              </div>
              <div>
                <Label className="font-semibold">Categoria *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="font-semibold text-sm">Permitir descarregar PDF</p>
                  <p className="text-xs text-muted-foreground">Quando desligado, os visitantes só podem visualizar inline.</p>
                </div>
                <Switch checked={allowDownload} onCheckedChange={setAllowDownload} />
              </div>

              <div className="rounded-lg border border-border/60 p-3 space-y-2">
                <p className="font-semibold text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />PDF atual</p>
                <p className="text-xs text-muted-foreground truncate">{track.pdf_path.split("/").pop()}</p>
                <Label className="text-xs">Substituir por:</Label>
                <Input type="file" accept="application/pdf" onChange={(e) => onPickPdf(e.target.files?.[0] ?? null)} />
                {newPdf && <p className="text-xs text-primary">Novo: {newPdf.name}</p>}
              </div>

              <div className="rounded-lg border border-border/60 p-3 space-y-2">
                <p className="font-semibold text-sm flex items-center gap-2"><MusicIcon className="h-4 w-4 text-primary" />Áudio</p>
                {track.audio_path && !removeAudio ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground truncate">{track.audio_path.split("/").pop()}</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => setRemoveAudio(true)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />Remover
                    </Button>
                  </div>
                ) : removeAudio ? (
                  <p className="text-xs text-destructive">Áudio será removido ao guardar. <button type="button" onClick={() => setRemoveAudio(false)} className="underline">Desfazer</button></p>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem áudio.</p>
                )}
                <Label className="text-xs">{track.audio_path ? "Substituir por" : "Adicionar"}:</Label>
                <Input type="file" accept="audio/mpeg,audio/mp3,.mp3" onChange={(e) => onPickAudio(e.target.files?.[0] ?? null)} />
                {newAudio && <p className="text-xs text-primary">Novo: {newAudio.name}</p>}
              </div>

              <div className="rounded-lg border border-border/60 p-3 space-y-2">
                <p className="font-semibold text-sm flex items-center gap-2"><ImgIcon className="h-4 w-4 text-primary" />Imagens ({keptImages.length + newImages.length}/{MAX_IMAGES})</p>
                {keptImages.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {keptImages.map((p) => (
                      <div key={p} className="relative group">
                        {imageUrls[p] ? (
                          <img src={imageUrls[p]} alt="" className="aspect-square w-full rounded object-cover border border-border/60" />
                        ) : (
                          <div className="aspect-square w-full rounded bg-muted" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeKeptImage(p)}
                          className="absolute top-1 right-1 rounded-full bg-destructive text-destructive-foreground p-1 opacity-90 hover:opacity-100"
                          aria-label="Remover"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Label className="text-xs">Adicionar imagens:</Label>
                <Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(e) => onPickImages(Array.from(e.target.files ?? []))} />
                {newImages.length > 0 && <p className="text-xs text-primary">{newImages.length} nova(s) imagem(ns) a adicionar</p>}
              </div>

              {!isAdmin && track.status !== "pending" && (
                <p className="text-xs text-muted-foreground rounded-md bg-muted/50 p-2">
                  Após guardar, o conteúdo voltará ao estado <strong>pendente</strong> e aguardará nova aprovação do administrador.
                </p>
              )}

              <Button type="submit" className="w-full" disabled={saving}>
                <UploadIcon className="h-4 w-4 mr-2" />{saving ? "A guardar..." : "Guardar alterações"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

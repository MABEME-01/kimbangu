import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { CATEGORIES, type CategoryValue } from "@/lib/categories";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload as UploadIcon, Hourglass, FileText, Music as MusicIcon, Image as ImgIcon } from "lucide-react";
import { CATEGORIES as CATS } from "@/lib/categories";

export const Route = createFileRoute("/upload")({
  component: UploadPage,
});

const MAX_PDF = 25 * 1024 * 1024; // 25 MB
const MAX_AUDIO = 30 * 1024 * 1024; // 30 MB
const MAX_IMAGE = 8 * 1024 * 1024; // 8 MB
const MAX_IMAGES = 10;
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_AUDIO = ["audio/mpeg", "audio/mp3"];

// Normalize spaces: trim + collapse internal whitespace
const normalizeSpaces = (s: string) => s.replace(/\s+/g, " ").trim();
// Author must contain at least one letter (unicode), allows letters, spaces, . ' - and digits but not only digits/symbols
const AUTHOR_VALID_RE = /^[\p{L}][\p{L}\p{M}\s.'\-]*[\p{L}.]?$/u;

const metaSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório").max(200),
  author: z
    .string()
    .trim()
    .max(150)
    .refine((v) => v === "" || AUTHOR_VALID_RE.test(v), {
      message: "Autor inválido: use apenas letras, espaços e . ' -",
    })
    .optional()
    .or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  category: z.string().min(1, "Categoria obrigatória"),
});

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

function UploadPage() {
  const { user, canUpload, uploadStatus, loading, refresh, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryValue | "">("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [authorSuggestions, setAuthorSuggestions] = useState<string[]>([]);
  const [showAuthorList, setShowAuthorList] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<Array<{ id: string; title: string; status: string; created_at: string }>>([]);

  const loadMySubmissions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tracks")
      .select("id,title,status,created_at")
      .eq("uploaded_by", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setMySubmissions((data ?? []) as any);
  };

  useEffect(() => {
    if (canUpload && user) loadMySubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUpload, user?.id]);

  // Load existing distinct authors for autocomplete
  useEffect(() => {
    supabase
      .from("tracks")
      .select("author")
      .not("author", "is", null)
      .then(({ data }) => {
        const set = new Set<string>();
        (data ?? []).forEach((r: any) => {
          const a = (r.author ?? "").toString().trim();
          if (a) set.add(a);
        });
        setAuthorSuggestions(Array.from(set).sort((a, b) => a.localeCompare(b)));
      });
  }, []);

  const filteredAuthors = useMemo(() => {
    const q = author.trim().toLowerCase();
    if (!q) return authorSuggestions.slice(0, 8);
    return authorSuggestions.filter((a) => a.toLowerCase().includes(q)).slice(0, 8);
  }, [author, authorSuggestions]);

  // Preview URLs for selected files
  const pdfPreview = useMemo(() => (pdf ? URL.createObjectURL(pdf) : null), [pdf]);
  const audioPreview = useMemo(() => (audio ? URL.createObjectURL(audio) : null), [audio]);
  const imagePreviews = useMemo(() => images.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })), [images]);
  useEffect(() => () => { if (pdfPreview) URL.revokeObjectURL(pdfPreview); }, [pdfPreview]);
  useEffect(() => () => { if (audioPreview) URL.revokeObjectURL(audioPreview); }, [audioPreview]);
  useEffect(() => () => { imagePreviews.forEach((p) => URL.revokeObjectURL(p.url)); }, [imagePreviews]);

  const categoryLabelFor = (v: string) => CATS.find((c) => c.value === v)?.label ?? "—";
  const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
  const hasAnyPreview = title || author || category || pdf || audio || images.length > 0;

  if (loading) return <div className="min-h-screen bg-background"><Header /><p className="container mx-auto p-8 text-muted-foreground">A carregar...</p></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 max-w-md">
          <Card>
            <CardContent className="py-10 text-center space-y-4">
              <p>Precisa de iniciar sessão para enviar conteúdos.</p>
              <Button asChild><Link to="/auth">Entrar / Registar</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const requestUploadPermission = async () => {
    const { error } = await supabase.from("profiles").update({ upload_status: "pending" }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Pedido enviado! Aguarde aprovação do administrador.");
    refresh();
  };

  if (!canUpload) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 max-w-lg">
          <Card>
            <CardHeader><CardTitle>Permissão de envio</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {uploadStatus === "pending" ? (
                <div className="rounded-lg border border-border p-4 flex items-start gap-3">
                  <Hourglass className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Pedido em análise</p>
                    <p className="text-sm text-muted-foreground">O administrador irá rever o seu pedido em breve.</p>
                  </div>
                </div>
              ) : uploadStatus === "rejected" ? (
                <>
                  <p className="text-sm text-destructive">O seu pedido anterior foi rejeitado.</p>
                  <Button onClick={requestUploadPermission}>Pedir novamente</Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    A sua conta ainda não tem permissão para enviar. Solicite acesso ao administrador.
                  </p>
                  <Button onClick={requestUploadPermission}><UploadIcon className="h-4 w-4 mr-2" /> Solicitar permissão de envio</Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const validateFiles = (): string | null => {
    if (!pdf) return "PDF é obrigatório.";
    if (pdf.type !== "application/pdf" && !pdf.name.toLowerCase().endsWith(".pdf")) return "O ficheiro principal deve ser um PDF.";
    if (pdf.size > MAX_PDF) return "PDF excede 25 MB.";
    if (audio) {
      if (!ALLOWED_AUDIO.includes(audio.type) && !audio.name.toLowerCase().endsWith(".mp3")) return "Áudio deve ser MP3.";
      if (audio.size > MAX_AUDIO) return "Áudio excede 30 MB.";
    }
    if (images.length > MAX_IMAGES) return `Máximo ${MAX_IMAGES} imagens.`;
    for (const img of images) {
      if (!ALLOWED_IMAGE.includes(img.type)) return `Imagem '${img.name}': formato não suportado.`;
      if (img.size > MAX_IMAGE) return `Imagem '${img.name}' excede 8 MB.`;
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedTitle = normalizeSpaces(title);
    const cleanedAuthor = normalizeSpaces(author);
    const cleanedDescription = description.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    const meta = metaSchema.safeParse({
      title: cleanedTitle,
      author: cleanedAuthor,
      description: cleanedDescription,
      category,
    });
    if (!meta.success) return toast.error(meta.error.issues[0].message);
    const fileErr = validateFiles();
    if (fileErr) return toast.error(fileErr);

    setSubmitting(true);
    try {
      const stamp = Date.now();
      const baseDir = `${user.id}/${stamp}`;

      const pdfPath = `${baseDir}/${safeName(pdf!.name)}`;
      const { error: pdfErr } = await supabase.storage.from("pdfs").upload(pdfPath, pdf!, { upsert: false, contentType: "application/pdf" });
      if (pdfErr) throw pdfErr;

      let audioPath: string | null = null;
      if (audio) {
        audioPath = `${baseDir}/${safeName(audio.name)}`;
        const { error } = await supabase.storage.from("audios").upload(audioPath, audio, { contentType: audio.type || "audio/mpeg" });
        if (error) throw error;
      }

      const imagePaths: string[] = [];
      for (const img of images) {
        const p = `${baseDir}/${safeName(img.name)}`;
        const { error } = await supabase.storage.from("images").upload(p, img, { contentType: img.type });
        if (error) throw error;
        imagePaths.push(p);
      }

      const { error: insErr } = await supabase.from("tracks").insert({
        title: meta.data.title,
        author: meta.data.author || null,
        description: meta.data.description || null,
        category: meta.data.category as CategoryValue,
        pdf_path: pdfPath,
        audio_path: audioPath,
        image_paths: imagePaths,
        uploaded_by: user.id,
        status: isAdmin ? "approved" : "pending",
      });
      if (insErr) throw insErr;

      if (isAdmin) {
        toast.success("Conteúdo publicado!");
        navigate({ to: "/library" });
      } else {
        toast.success("Conteúdo enviado para aprovação do administrador.");
        // Reset form so user can see "Os meus envios"
        setTitle(""); setAuthor(""); setDescription(""); setCategory("");
        setPdf(null); setAudio(null); setImages([]);
        loadMySubmissions();
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro no envio");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <Card className="border-2 border-primary/40 shadow-[var(--shadow-elegant)]">
          <CardHeader><CardTitle>Enviar novo conteúdo</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div>
                <Label className="font-semibold text-foreground">Título *</Label>
                <Input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="border-2 border-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 bg-background" />
              </div>
              <div className="relative">
                <Label className="font-semibold text-foreground">Autor do hino</Label>
                <Input
                  value={author}
                  onChange={(e) => { setAuthor(e.target.value); setShowAuthorList(true); }}
                  onFocus={() => setShowAuthorList(true)}
                  onBlur={() => setTimeout(() => setShowAuthorList(false), 150)}
                  maxLength={150}
                  placeholder="Nome do autor (opcional)"
                  autoComplete="off"
                  className="border-2 border-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 bg-background"
                />
                {showAuthorList && filteredAuthors.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-md">
                    {filteredAuthors.map((a) => (
                      <li key={a}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); setAuthor(a); setShowAuthorList(false); }}
                          className="block w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        >
                          {a}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-xs text-muted-foreground">Sugestões com base em autores já cadastrados.</p>
              </div>
              <div>
                <Label className="font-semibold text-foreground">Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className="border-2 border-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 bg-background" />
              </div>
              <div>
                <Label className="font-semibold text-foreground">Categoria *</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as CategoryValue)}>
                  <SelectTrigger className="border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/30 bg-background"><SelectValue placeholder="Escolha uma categoria" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-semibold text-foreground">PDF * <span className="text-xs text-muted-foreground font-normal">(máx. 25 MB)</span></Label>
                <Input type="file" accept="application/pdf" required onChange={(e) => setPdf(e.target.files?.[0] ?? null)} className="border-2 border-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 bg-background" />
              </div>
              <div>
                <Label className="font-semibold text-foreground">Áudio (MP3) — opcional <span className="text-xs text-muted-foreground font-normal">(máx. 30 MB)</span></Label>
                <Input type="file" accept="audio/mpeg,audio/mp3" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} className="border-2 border-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 bg-background" />
              </div>
              <div>
                <Label className="font-semibold text-foreground">Imagens — opcional <span className="text-xs text-muted-foreground font-normal">(máx. 10 ficheiros, 8 MB cada — JPG/PNG/WEBP/GIF)</span></Label>
                <Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(e) => setImages(Array.from(e.target.files ?? []))} className="border-2 border-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 bg-background" />
                {images.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{images.length} ficheiro(s) selecionado(s)</p>}
              </div>

              {hasAnyPreview && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Pré-visualização</h3>
                    <span className="text-xs text-muted-foreground">Antes de submeter</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-background p-3 border border-border/60">
                      <p className="text-xs text-muted-foreground">Título</p>
                      <p className="font-medium truncate">{title || <span className="text-muted-foreground italic">— em falta</span>}</p>
                    </div>
                    <div className="rounded-lg bg-background p-3 border border-border/60">
                      <p className="text-xs text-muted-foreground">Categoria</p>
                      <p className="font-medium">{category ? categoryLabelFor(category) : <span className="text-muted-foreground italic">— em falta</span>}</p>
                    </div>
                    {author && (
                      <div className="rounded-lg bg-background p-3 border border-border/60 sm:col-span-2">
                        <p className="text-xs text-muted-foreground">Autor</p>
                        <p className="font-medium truncate">{author}</p>
                      </div>
                    )}
                  </div>
                  {description && (
                    <div className="rounded-lg bg-background p-3 border border-border/60 text-sm">
                      <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                      <p className="whitespace-pre-wrap">{description}</p>
                    </div>
                  )}
                  {pdf && pdfPreview && (
                    <div className="rounded-lg bg-background border border-border/60 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 text-sm">
                        <span className="inline-flex items-center gap-2 font-medium"><FileText className="h-4 w-4 text-primary" /> {pdf.name}</span>
                        <span className="text-xs text-muted-foreground">{fmtSize(pdf.size)}</span>
                      </div>
                      <iframe src={pdfPreview} className="w-full h-72 bg-background" title="Pré-visualização do PDF" />
                    </div>
                  )}
                  {audio && audioPreview && (
                    <div className="rounded-lg bg-background border border-border/60 p-3">
                      <div className="flex items-center justify-between mb-2 text-sm">
                        <span className="inline-flex items-center gap-2 font-medium"><MusicIcon className="h-4 w-4 text-primary" /> {audio.name}</span>
                        <span className="text-xs text-muted-foreground">{fmtSize(audio.size)}</span>
                      </div>
                      <audio controls src={audioPreview} className="w-full" />
                    </div>
                  )}
                  {imagePreviews.length > 0 && (
                    <div className="rounded-lg bg-background border border-border/60 p-3">
                      <p className="text-sm font-medium inline-flex items-center gap-2 mb-2"><ImgIcon className="h-4 w-4 text-primary" /> {imagePreviews.length} imagem(ns)</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {imagePreviews.map((p) => (
                          <img key={p.url} src={p.url} alt={p.name} className="aspect-square w-full rounded-md object-cover border border-border/60" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "A enviar..." : "Enviar conteúdo"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader><CardTitle>Os meus envios</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {mySubmissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não enviou nenhum conteúdo.</p>
            ) : (
              mySubmissions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("pt-PT")}</p>
                  </div>
                  {s.status === "approved" ? (
                    <Badge>Aprovado</Badge>
                  ) : s.status === "rejected" ? (
                    <Badge variant="destructive">Rejeitado</Badge>
                  ) : (
                    <Badge variant="secondary">Pendente</Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

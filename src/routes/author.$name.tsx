import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage";
import { Header } from "@/components/app/Header";
import { categoryLabel } from "@/lib/categories";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Music, Image as ImgIcon, ChevronLeft, ChevronRight, User } from "lucide-react";

type AuthorSearch = { page?: number };

export const Route = createFileRoute("/author/$name")({
  component: AuthorPage,
  validateSearch: (s: Record<string, unknown>): AuthorSearch => ({
    page: typeof s.page === "number" ? s.page : typeof s.page === "string" ? parseInt(s.page, 10) || undefined : undefined,
  }),
});

const PAGE_SIZE = 12;

type Track = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  category: string;
  pdf_path: string;
  audio_path: string | null;
  image_paths: string[];
  created_at: string;
};

function CoverImage({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getSignedUrl("images", path).then((u) => active && setUrl(u));
    return () => { active = false; };
  }, [path]);
  if (!url) return <div className="h-full w-full" style={{ background: "var(--gradient-primary)" }} />;
  return <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />;
}

function AuthorPage() {
  const { name } = Route.useParams();
  const raw = Route.useSearch();
  const navigate = Route.useNavigate();
  const decodedName = useMemo(() => {
    try { return decodeURIComponent(name); } catch { return name; }
  }, [name]);

  const page = raw.page ?? 1;
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("tracks")
      .select("id,title,author,description,category,pdf_path,audio_path,image_paths,created_at")
      .eq("author", decodedName)
      .eq("status", "approved")
      .order("title", { ascending: true })
      .then(({ data }) => {
        setTracks((data ?? []) as Track[]);
        setLoading(false);
      });
  }, [decodedName]);

  const totalPages = Math.max(1, Math.ceil(tracks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = tracks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const setPage = (p: number) => navigate({ search: { page: p } });
  const startIdx = tracks.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(currentPage * PAGE_SIZE, tracks.length);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="border-b border-border/40" style={{ background: "var(--gradient-hero)" }}>
        <div className="container mx-auto px-4 py-10 text-primary-foreground">
          <Button variant="ghost" asChild className="text-primary-foreground hover:bg-white/10 mb-3 -ml-3">
            <Link to="/library"><ArrowLeft className="h-4 w-4 mr-2" />Biblioteca</Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-white/15 flex items-center justify-center">
              <User className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider opacity-80">Autor</p>
              <h1 className="text-2xl sm:text-3xl font-bold">{decodedName}</h1>
            </div>
          </div>
          <p className="mt-3 text-sm opacity-90">
            <span className="font-semibold">{tracks.length}</span> conteúdo(s) deste autor
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 pb-20">
        {loading ? (
          <p className="text-muted-foreground">A carregar...</p>
        ) : tracks.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">Nenhum conteúdo deste autor.</CardContent></Card>
        ) : (
          <>
            {tracks.length > PAGE_SIZE && (
              <p className="mb-4 text-sm text-muted-foreground">A mostrar {startIdx}–{endIdx} de {tracks.length}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {paged.map((t) => (
                <Link key={t.id} to="/track/$id" params={{ id: t.id }} className="group">
                  <Card className="h-full overflow-hidden border-border/60 transition hover:shadow-[var(--shadow-elegant)] hover:-translate-y-0.5">
                    <div className="h-32 w-full" style={{ background: "var(--gradient-primary)" }}>
                      {t.image_paths[0] ? (
                        <CoverImage path={t.image_paths[0]} alt={t.title} />
                      ) : (
                        <div className="flex h-full items-center justify-center text-primary-foreground/80">
                          <FileText className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-5">
                      <Badge variant="secondary" className="mb-2 text-sm px-3 py-1">{categoryLabel(t.category)}</Badge>
                      <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition">{t.title}</h3>
                      {t.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{t.description}</p>}
                      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> PDF</span>
                        {t.audio_path && <span className="inline-flex items-center gap-1"><Music className="h-3.5 w-3.5" /> Áudio</span>}
                        {t.image_paths.length > 0 && <span className="inline-flex items-center gap-1"><ImgIcon className="h-3.5 w-3.5" /> {t.image_paths.length}</span>}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-2">Página {currentPage} de {totalPages}</span>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                  Seguinte <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage";
import { Header } from "@/components/app/Header";
import { useCategories, categoryLabel } from "@/lib/categories";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Search, Music, FileText, Image as ImgIcon, ArrowUpAZ, ChevronLeft, ChevronRight, ListFilter, X, Upload, Eye } from "lucide-react";

type LibrarySearch = { q?: string; cats?: string; sort?: "asc" | "desc"; page?: number };

export const Route = createFileRoute("/library")({
  component: LibraryPage,
  validateSearch: (s: Record<string, unknown>): LibrarySearch => ({
    q: typeof s.q === "string" ? s.q : undefined,
    cats: typeof s.cats === "string" ? s.cats : undefined,
    sort: s.sort === "desc" ? "desc" : s.sort === "asc" ? "asc" : undefined,
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
  if (!url) {
    return <div className="h-full w-full" style={{ background: "var(--gradient-primary)" }} />;
  }
  return <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />;
}

function LibraryPage() {
  const raw = Route.useSearch();
  const search = {
    q: raw.q ?? "",
    cats: raw.cats ?? "",
    sort: raw.sort ?? "asc",
    page: raw.page ?? 1,
  };
  const navigate = Route.useNavigate();
  const { categories } = useCategories();
  const selectedCats = useMemo(
    () => (search.cats ? search.cats.split(",").filter(Boolean) : []),
    [search.cats]
  );

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [draftCats, setDraftCats] = useState<string[]>(selectedCats);
  useEffect(() => { if (catModalOpen) setDraftCats(selectedCats); }, [catModalOpen, selectedCats]);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(search.q);

  useEffect(() => {
    supabase
      .from("tracks")
      .select("id,title,author,description,category,pdf_path,audio_path,image_paths,created_at")
      .eq("status", "approved")
      .order("title", { ascending: true })
      .then(({ data }) => {
        setTracks((data ?? []) as Track[]);
        setLoading(false);
      });
  }, []);

  // Debounce query → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (query !== search.q) navigate({ search: { ...search, q: query, page: 1 }, replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [query]); // eslint-disable-line

  const applyCats = (list: string[]) => {
    navigate({ search: { ...search, cats: list.join(",") || undefined, page: 1 } });
  };
  const toggleSort = () => navigate({ search: { ...search, sort: search.sort === "asc" ? "desc" : "asc" } });
  const setPage = (p: number) => navigate({ search: { ...search, page: p } });

  const filtered = useMemo(() => {
    const q = search.q.toLowerCase().trim();
    let list = tracks.filter((t) => {
      const catOk = selectedCats.length === 0 || selectedCats.includes(t.category);
      const text = `${t.title} ${t.author ?? ""}`.toLowerCase();
      const qOk = q === "" || text.includes(q);
      return catOk && qOk;
    });
    list = [...list].sort((a, b) =>
      search.sort === "asc" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)
    );
    return list;
  }, [tracks, search.q, selectedCats, search.sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(search.page, totalPages);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(page * PAGE_SIZE, filtered.length);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="relative overflow-hidden border-b border-border/40" style={{ background: "var(--gradient-hero)" }}>
        <div className="container mx-auto px-4 py-12 sm:py-16 text-primary-foreground">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight max-w-3xl">
            Biblioteca Musical
          </h1>
          <p className="mt-3 max-w-2xl text-base opacity-90">
            Pesquise e explore partituras, áudios e imagens — organizadas por categoria.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8">
        <div className="flex flex-row items-center gap-2 sm:gap-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Pesquisar por título ou autor..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" maxLength={100} />
          </div>
          <Button variant="outline" onClick={toggleSort} className="shrink-0">
            <ArrowUpAZ className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{search.sort === "asc" ? "A → Z" : "Z → A"}</span>
            <span className="sm:hidden">{search.sort === "asc" ? "A-Z" : "Z-A"}</span>
          </Button>
          <Button asChild className="shrink-0">
            <Link to="/upload"><Upload className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Enviar conteúdo</span></Link>
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Dialog open={catModalOpen} onOpenChange={setCatModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ListFilter className="h-4 w-4" />
                Categorias
                {selectedCats.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{selectedCats.length}</Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Selecionar categorias</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-1">
                {categories.map((c) => {
                  const checked = draftCats.includes(c.value);
                  return (
                    <label key={c.value} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 cursor-pointer hover:bg-accent">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setDraftCats((prev) => v ? [...prev, c.value] : prev.filter((x) => x !== c.value));
                        }}
                      />
                      <span className="text-sm">{c.label}</span>
                    </label>
                  );
                })}
              </div>
              <DialogFooter className="flex sm:justify-between gap-2">
                <Button variant="ghost" onClick={() => setDraftCats([])}>Limpar</Button>
                <Button onClick={() => { applyCats(draftCats); setCatModalOpen(false); }}>Aplicar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {selectedCats.length === 0 ? (
            <span className="text-sm text-muted-foreground">A mostrar todas as categorias</span>
          ) : (
            selectedCats.map((v) => (
              <Badge key={v} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                {categoryLabel(v)}
                <button
                  onClick={() => applyCats(selectedCats.filter((x) => x !== v))}
                  className="ml-1 rounded-full hover:bg-background/60 p-0.5"
                  aria-label={`Remover ${categoryLabel(v)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20">
        {loading ? (
          <p className="text-muted-foreground">A carregar biblioteca...</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Nenhum conteúdo encontrado. {tracks.length === 0 && "Aguardamos os primeiros envios."}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{filtered.length}</span> resultado(s)
                {filtered.length > PAGE_SIZE && <> · A mostrar {startIdx}–{endIdx}</>}
              </span>
              {totalPages > 1 && <span>Página {page} de {totalPages}</span>}
            </div>

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
                      {t.author && <p className="mt-0.5 text-xs text-muted-foreground">por {t.author}</p>}
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
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-2">Página {page} de {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Seguinte <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        FLAUKI — Biblioteca Musical · Conteúdos religiosos com devoção
      </footer>
    </div>
  );
}

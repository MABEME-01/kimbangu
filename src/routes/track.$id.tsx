import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/app/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { categoryLabel } from "@/lib/categories";
import { ArrowLeft, Trash2, Download, FileDown, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { categoryLabel as catLabel } from "@/lib/categories";

export const Route = createFileRoute("/track/$id")({
  component: TrackPage,
});

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
  status?: string;
};

function TrackPage() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    supabase.from("tracks").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setTrack(data as Track | null);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="min-h-screen bg-background"><Header /><p className="container mx-auto p-8 text-muted-foreground">A carregar...</p></div>;
  if (!track) return <div className="min-h-screen bg-background"><Header /><p className="container mx-auto p-8">Não encontrado.</p></div>;

  const isOwner = !!user && user.id === track.uploaded_by;
  if (track.status && track.status !== "approved" && !isAdmin && !isOwner) {
    return <div className="min-h-screen bg-background"><Header /><p className="container mx-auto p-8">Conteúdo indisponível.</p></div>;
  }

  const statusBanner = track.status && track.status !== "approved" ? (
    <div className={`mb-6 rounded-lg border p-3 text-sm ${track.status === "rejected" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-primary/40 bg-primary/5"}`}>
      {track.status === "pending"
        ? "Este conteúdo está aguardando aprovação do administrador. Apenas você e o administrador podem vê-lo."
        : "Este conteúdo foi rejeitado pelo administrador e não está visível na biblioteca."}
    </div>
  ) : null;

  const pdfUrl = supabase.storage.from("pdfs").getPublicUrl(track.pdf_path).data.publicUrl;
  const pdfViewerUrl = `${pdfUrl}#toolbar=1&view=FitH`;
  const audioUrl = track.audio_path ? supabase.storage.from("audios").getPublicUrl(track.audio_path).data.publicUrl : null;
  const imageUrls = track.image_paths.map((p) => supabase.storage.from("images").getPublicUrl(p).data.publicUrl);
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () => setLightboxIndex((i) => (i === null ? null : (i - 1 + imageUrls.length) % imageUrls.length));
  const nextImage = () => setLightboxIndex((i) => (i === null ? null : (i + 1) % imageUrls.length));

  const canDelete = isAdmin || (user && user.id === track.uploaded_by);

  const onDelete = async () => {
    if (!confirm("Eliminar este conteúdo?")) return;
    const { error } = await supabase.from("tracks").delete().eq("id", track.id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado.");
    navigate({ to: "/" });
  };

  const exportDetailsPdf = () => {
    if (!track) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 48;
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("FLAUKI — Biblioteca Musical", margin, y);
    y += 22;

    doc.setFontSize(20);
    doc.setTextColor(20);
    const titleLines = doc.splitTextToSize(track.title, pageW - margin * 2);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 24 + 6;

    if (track.author) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(20);
      const authorLines = doc.splitTextToSize(track.author, pageW - margin * 2);
      doc.text(authorLines, margin, y);
      y += authorLines.length * 24 + 6;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80);
    doc.text(`Categoria: ${catLabel(track.category)}`, margin, y);
    y += 18;

    if (track.description) {
      doc.setTextColor(40);
      doc.text("Descrição", margin, y); y += 16;
      doc.setTextColor(80);
      const desc = doc.splitTextToSize(track.description, pageW - margin * 2);
      doc.text(desc, margin, y);
      y += desc.length * 14 + 10;
    }

    doc.setTextColor(40);
    doc.setFont("helvetica", "bold");
    doc.text("Anexos", margin, y); y += 18;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);

    const fileName = (p: string) => p.split("/").pop() ?? p;
    const items: string[] = [];
    items.push(`• PDF: ${fileName(track.pdf_path)}`);
    if (track.audio_path) items.push(`• Áudio (MP3): ${fileName(track.audio_path)}`);
    if (track.image_paths.length > 0) {
      items.push(`• Imagens (${track.image_paths.length}):`);
      track.image_paths.forEach((p) => items.push(`    – ${fileName(p)}`));
    }
    items.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, pageW - margin * 2);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 14;
      if (y > 780) { doc.addPage(); y = margin; }
    });

    y += 20;
    doc.setFontSize(9);
    doc.setTextColor(140);
    const captionParts = [track.title];
    if (track.author) captionParts.push(track.author);
    doc.text(`${captionParts.join(" — ")} · Gerado em ${new Date().toLocaleString("pt-PT")} · flauki`, margin, y);

    const safe = track.title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "conteudo";
    doc.save(`flauki_${safe}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {statusBanner}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" asChild><Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Link></Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportDetailsPdf}>
              <FileDown className="h-4 w-4 mr-2" />Exportar detalhes
            </Button>
            {canDelete && (
              <Button variant="destructive" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 mr-2" />Eliminar</Button>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h2 className="mb-2 text-base sm:text-lg font-semibold text-primary uppercase tracking-wide">{categoryLabel(track.category)}</h2>
          <h1 className="text-3xl sm:text-4xl font-bold">{track.title}</h1>
          {track.author && (
            <p className="mt-1 text-sm text-muted-foreground">
              Arranjado pelo:{" "}
              <Link to="/author/$name" params={{ name: encodeURIComponent(track.author) }} className="underline hover:text-primary">
                {track.author}
              </Link>
            </p>
          )}
          {track.description && <p className="mt-2 text-muted-foreground">{track.description}</p>}
        </div>

        {audioUrl && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <audio
                controls
                preload="metadata"
                controlsList="nodownload"
                className="w-full"
                src={audioUrl}
              />
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 overflow-hidden">
          <div className="flex items-center justify-between bg-muted/50 px-4 py-2 border-b border-border">
            <span className="text-sm font-medium">Partitura (PDF)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={pdfViewerUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Abrir</a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={pdfUrl} target="_blank" rel="noreferrer" download><Download className="h-4 w-4 mr-2" />Descarregar</a>
              </Button>
            </div>
          </div>
          <object data={pdfViewerUrl} type="application/pdf" className="w-full h-[80vh] bg-background">
            <iframe src={pdfViewerUrl} className="w-full h-[80vh] bg-background" title={track.title} />
            <div className="p-6 text-center text-sm text-muted-foreground">
              O seu navegador não suporta visualização de PDF integrada.{" "}
              <a className="underline text-primary" href={pdfViewerUrl} target="_blank" rel="noreferrer">Abrir o PDF numa nova aba</a>.
            </div>
          </object>
        </Card>

        {track.image_paths.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Imagens</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {imageUrls.map((url, idx) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setLightboxIndex(idx)}
                  className="group relative overflow-hidden rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label={`Abrir imagem ${idx + 1}`}
                >
                  <img src={url} alt={`Imagem ${idx + 1}`} className="w-full aspect-square object-cover transition group-hover:scale-105" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}

        <Dialog open={lightboxIndex !== null} onOpenChange={(o) => !o && closeLightbox()}>
          <DialogContent className="max-w-5xl p-0 bg-background/95 border-border">
            {lightboxIndex !== null && (
              <div className="relative">
                <img
                  src={imageUrls[lightboxIndex]}
                  alt={`Imagem ${lightboxIndex + 1}`}
                  className="w-full max-h-[85vh] object-contain bg-black"
                />
                {imageUrls.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full"
                      onClick={prevImage}
                      aria-label="Imagem anterior"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
                      onClick={nextImage}
                      aria-label="Imagem seguinte"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </>
                )}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs text-foreground border border-border">
                  {lightboxIndex + 1} / {imageUrls.length}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/app/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { categoryLabel, fetchCategories } from "@/lib/categories";
import { ArrowLeft, Trash2, FileDown, Pencil, AlertCircle, Hourglass, CheckCircle2, Eye, Download, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { MediaViewer } from "@/components/app/MediaViewer";
import { TrackHistory } from "@/components/app/TrackHistory";

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
  status: string;
  allow_download: boolean;
  rejection_reason: string | null;
  view_count: number;
  download_count: number;
  play_count: number;
};

function TrackPage() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);
  const [resubmitting, setResubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
    supabase.from("tracks").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setTrack(data as Track | null);
      setLoading(false);
    });
  }, [id]);

  // Increment view once per session per track for approved content
  useEffect(() => {
    if (!track || track.status !== "approved") return;
    const key = `viewed:${track.id}`;
    if (typeof window === "undefined" || sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.rpc("increment_track_view", { _track_id: track.id });
  }, [track?.id, track?.status]);

  if (loading) return <div className="min-h-screen bg-background"><Header /><p className="container mx-auto p-8 text-muted-foreground">A carregar...</p></div>;
  if (!track) return <div className="min-h-screen bg-background"><Header /><p className="container mx-auto p-8">Não encontrado.</p></div>;

  const isOwner = !!user && user.id === track.uploaded_by;
  if (track.status !== "approved" && !isAdmin && !isOwner) {
    return <div className="min-h-screen bg-background"><Header /><p className="container mx-auto p-8">Conteúdo indisponível.</p></div>;
  }

  const canEdit = isAdmin || isOwner;
  const canDelete = canEdit;
  const canSeeHistory = isAdmin || isOwner || track.status === "approved";

  const onDelete = async () => {
    if (!confirm("Eliminar este conteúdo? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("tracks").delete().eq("id", track.id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado.");
    navigate({ to: "/library" });
  };

  const resubmit = async () => {
    if (!isOwner) return;
    setResubmitting(true);
    const { error } = await supabase
      .from("tracks")
      .update({ status: "pending", rejection_reason: null })
      .eq("id", track.id);
    setResubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Envio reenviado para revisão do administrador.");
    setTrack({ ...track, status: "pending", rejection_reason: null });
  };

  const exportDetailsPdf = () => {
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
      const authorLines = doc.splitTextToSize(`Arranjado pelo: ${track.author}`, pageW - margin * 2);
      doc.setFontSize(12);
      doc.setTextColor(80);
      doc.text(authorLines, margin, y);
      y += authorLines.length * 16 + 6;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80);
    doc.text(`Categoria: ${categoryLabel(track.category)}`, margin, y);
    y += 18;
    if (track.description) {
      doc.setTextColor(40);
      doc.text("Descrição", margin, y); y += 16;
      doc.setTextColor(80);
      const desc = doc.splitTextToSize(track.description, pageW - margin * 2);
      doc.text(desc, margin, y);
      y += desc.length * 14 + 10;
    }
    const safe = track.title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "conteudo";
    doc.save(`flauki_${safe}.pdf`);
  };

  const statusBanner = (() => {
    if (track.status === "approved") return null;
    if (track.status === "pending") {
      return (
        <div className="mb-6 rounded-lg border border-primary/40 bg-primary/5 p-4 flex gap-3">
          <Hourglass className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Aguardando aprovação</p>
            <p className="text-muted-foreground mt-1">O administrador irá rever este envio em breve. Apenas você e o administrador podem vê-lo enquanto aguarda.</p>
          </div>
        </div>
      );
    }
    if (track.status === "rejected") {
      return (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-3">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Envio rejeitado</p>
              {track.rejection_reason ? (
                <p className="text-foreground/80 mt-1"><span className="font-medium">Motivo:</span> {track.rejection_reason}</p>
              ) : (
                <p className="text-muted-foreground mt-1">O administrador rejeitou este envio. Pode editar e voltar a submeter.</p>
              )}
            </div>
          </div>
          {isOwner && (
            <div className="flex flex-wrap gap-2 pl-8">
              <Button size="sm" variant="outline" asChild>
                <Link to="/track/$id/edit" params={{ id: track.id }}>
                  <Pencil className="h-4 w-4 mr-1" />Editar e reenviar
                </Link>
              </Button>
              <Button size="sm" disabled={resubmitting} onClick={resubmit}>
                <RefreshCw className="h-4 w-4 mr-1" />{resubmitting ? "A reenviar..." : "Reenviar como está"}
              </Button>
            </div>
          )}
        </div>
      );
    }
    return null;
  })();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {statusBanner}
        <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
          <Button variant="ghost" asChild><Link to="/library"><ArrowLeft className="h-4 w-4 mr-2" />Biblioteca</Link></Button>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={exportDetailsPdf}>
              <FileDown className="h-4 w-4 mr-2" />Exportar detalhes
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/track/$id/edit" params={{ id: track.id }}>
                  <Pencil className="h-4 w-4 mr-2" />Editar
                </Link>
              </Button>
            )}
            {canDelete && (
              <Button variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-2" />Eliminar
              </Button>
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
          {track.status === "approved" && isOwner && (
            <Badge variant="secondary" className="mt-2 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Publicado
            </Badge>
          )}
          {track.status === "approved" && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {track.view_count} visualização(ões)</span>
              {track.audio_path && <span className="inline-flex items-center gap-1"><Play className="h-3.5 w-3.5" /> {track.play_count} reprodução(ões)</span>}
              {track.allow_download && <span className="inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" /> {track.download_count} descarga(s)</span>}
            </div>
          )}
          {track.description && <p className="mt-3 text-muted-foreground whitespace-pre-wrap">{track.description}</p>}
        </div>

        <MediaViewer
          pdfPath={track.pdf_path}
          audioPath={track.audio_path}
          imagePaths={track.image_paths}
          title={track.title}
          allowDownload={track.allow_download}
          trackId={track.id}
          countable={track.status === "approved"}
        />

        {canSeeHistory && (
          <div className="mt-8">
            <TrackHistory trackId={track.id} />
          </div>
        )}
      </div>
    </div>
  );
}

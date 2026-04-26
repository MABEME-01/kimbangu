import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { getSignedUrl, getSignedUrls } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  pdfPath: string;
  audioPath: string | null;
  imagePaths: string[];
  title: string;
  allowDownload: boolean;
  trackId?: string;
  countable?: boolean;
};

export function MediaViewer({ pdfPath, audioPath, imagePaths, title, allowDownload, trackId, countable }: Props) {
  const playedRef = useRef(false);
  const downloadedRef = useRef(false);

  const onPlay = () => {
    if (!countable || !trackId || playedRef.current) return;
    playedRef.current = true;
    supabase.rpc("increment_track_play", { _track_id: trackId });
  };
  const onDownload = () => {
    if (!countable || !trackId || downloadedRef.current) return;
    downloadedRef.current = true;
    supabase.rpc("increment_track_download", { _track_id: trackId });
  };
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getSignedUrl("pdfs", pdfPath),
      audioPath ? getSignedUrl("audios", audioPath) : Promise.resolve(null),
      getSignedUrls("images", imagePaths),
    ]).then(([p, a, imgs]) => {
      if (!active) return;
      setPdfUrl(p);
      setAudioUrl(a);
      setImageUrls(imgs);
      setLoading(false);
    });
    return () => { active = false; };
  }, [pdfPath, audioPath, imagePaths.join(",")]);

  const pdfViewerUrl = pdfUrl ? `${pdfUrl}#toolbar=1&view=FitH` : null;
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () =>
    setLightboxIndex((i) => (i === null ? null : (i - 1 + imageUrls.length) % imageUrls.length));
  const nextImage = () =>
    setLightboxIndex((i) => (i === null ? null : (i + 1) % imageUrls.length));

  return (
    <div className="space-y-6">
      {audioUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-medium">Áudio</p>
            <audio
              controls
              preload="metadata"
              controlsList={allowDownload ? undefined : "nodownload"}
              className="w-full"
              src={audioUrl}
            />
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between bg-muted/50 px-4 py-2 border-b border-border">
          <span className="text-sm font-medium">Partitura (PDF)</span>
          <div className="flex gap-2">
            {pdfViewerUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={pdfViewerUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />Abrir em nova aba
                </a>
              </Button>
            )}
            {allowDownload && pdfUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={pdfUrl} target="_blank" rel="noreferrer" download>
                  <Download className="h-4 w-4 mr-2" />Descarregar
                </a>
              </Button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-[60vh] bg-muted/20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pdfViewerUrl ? (
          <object data={pdfViewerUrl} type="application/pdf" className="w-full h-[80vh] bg-background">
            <iframe src={pdfViewerUrl} className="w-full h-[80vh] bg-background" title={title} />
            <div className="p-6 text-center text-sm text-muted-foreground">
              O seu navegador não suporta visualização de PDF integrada.{" "}
              <a className="underline text-primary" href={pdfViewerUrl} target="_blank" rel="noreferrer">
                Abrir em nova aba
              </a>.
            </div>
          </object>
        ) : (
          <div className="p-6 text-center text-sm text-destructive flex flex-col items-center gap-2">
            <FileText className="h-8 w-8" />
            <p>Não foi possível carregar o PDF.</p>
          </div>
        )}
      </Card>

      {imageUrls.length > 0 && (
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
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

type HistoryRow = {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  changed_by_name: string | null;
  created_at: string;
};

const FIELD_LABEL: Record<string, string> = {
  created: "Criação",
  title: "Título",
  author: "Autor",
  description: "Descrição",
  category: "Categoria",
  pdf: "PDF",
  audio: "Áudio",
  images: "Nº de imagens",
  allow_download: "Permitir download",
  status: "Estado",
  rejection_reason: "Motivo de rejeição",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "pendente",
  approved: "aprovado",
  rejected: "rejeitado",
};

function fmtVal(field: string, v: string | null) {
  if (v === null || v === "") return <span className="italic text-muted-foreground">—</span>;
  if (field === "status") return STATUS_LABEL[v] ?? v;
  if (field === "allow_download") return v === "true" ? "sim" : "não";
  if (field === "pdf" || field === "audio") {
    const name = v.split("/").pop() ?? v;
    return <span className="font-mono text-xs">{name}</span>;
  }
  if (v.length > 80) return v.slice(0, 80) + "…";
  return v;
}

export function TrackHistory({ trackId }: { trackId: string }) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("track_history")
      .select("id,field,old_value,new_value,note,changed_by_name,created_at")
      .eq("track_id", trackId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!active) return;
        setRows((data ?? []) as HistoryRow[]);
        setLoading(false);
      });
    return () => { active = false; };
  }, [trackId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> Histórico de alterações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">A carregar...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem registos.</p>
        ) : (
          <ol className="relative border-l border-border/60 ml-2 space-y-4">
            {rows.map((r) => (
              <li key={r.id} className="ml-4">
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">{FIELD_LABEL[r.field] ?? r.field}</Badge>
                  <span>{new Date(r.created_at).toLocaleString("pt-PT")}</span>
                  {r.changed_by_name && <span>· por {r.changed_by_name}</span>}
                </div>
                {r.field === "created" ? (
                  <p className="mt-1 text-sm">Hino criado.</p>
                ) : (
                  <p className="mt-1 text-sm">
                    {fmtVal(r.field, r.old_value)} <span className="text-muted-foreground">→</span> {fmtVal(r.field, r.new_value)}
                  </p>
                )}
                {r.note && <p className="mt-1 text-xs text-muted-foreground italic">"{r.note}"</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

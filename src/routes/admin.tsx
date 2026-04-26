import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/app/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, X, Shield, Mail, Trash2, MailOpen, ArrowUpDown, ChevronLeft, ChevronRight, FileText, Eye, Music as MusicIcon, Tag, Plus, Pencil } from "lucide-react";
import { getSignedUrl } from "@/lib/storage";
import { fetchCategories, useCategories } from "@/lib/categories";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  upload_status: string;
};
type RoleRow = { user_id: string; role: "admin" | "uploader" | "user" };
type ContactMsg = { id: string; name: string; email: string | null; subject: string | null; message: string; created_at: string; is_read: boolean };
type PendingTrack = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  category: string;
  pdf_path: string;
  audio_path: string | null;
  image_paths: string[];
  created_at: string;
  uploaded_by: string | null;
  status: string;
};

const PAGE_SIZE = 10;

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, string[]>>({});
  const [messages, setMessages] = useState<ContactMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ContactMsg | null>(null);
  const [pendingTracks, setPendingTracks] = useState<PendingTrack[]>([]);
  const [previewTrack, setPreviewTrack] = useState<PendingTrack | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewImageUrls, setPreviewImageUrls] = useState<string[]>([]);
  // Rejection dialog
  const [rejectTarget, setRejectTarget] = useState<{ id: string; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  // Category management
  const { categories } = useCategories();
  const [newCatLabel, setNewCatLabel] = useState("");
  const [editCat, setEditCat] = useState<{ value: string; label: string } | null>(null);
  const [editCatLabel, setEditCatLabel] = useState("");

  const load = async () => {
    const { data: profs } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    const { data: rs } = await supabase.from("user_roles").select("user_id, role");
    const { data: msgs } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false });
    const { data: tks } = await supabase.from("tracks").select("*").eq("status", "pending").order("created_at", { ascending: false });
    setProfiles((profs ?? []) as Profile[]);
    const map: Record<string, string[]> = {};
    (rs as RoleRow[] | null)?.forEach((r) => {
      map[r.user_id] = [...(map[r.user_id] ?? []), r.role];
    });
    setRolesByUser(map);
    setMessages((msgs ?? []) as ContactMsg[]);
    setPendingTracks((tks ?? []) as PendingTrack[]);
  };

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const ch1 = supabase
      .channel("contact_messages_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_messages" }, () => load())
      .subscribe();
    const ch2 = supabase
      .channel("tracks_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "tracks" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [isAdmin]);

  if (loading) return <div className="min-h-screen bg-background"><Header /><p className="container mx-auto p-8">A carregar...</p></div>;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto p-8 max-w-md">
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <Shield className="h-10 w-10 mx-auto text-muted-foreground" />
              <p>Acesso restrito a administradores.</p>
              <Button asChild><Link to="/">Voltar</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const approve = async (userId: string) => {
    setBusy(true);
    const { error: e1 } = await supabase.from("user_roles").insert({ user_id: userId, role: "uploader" });
    if (e1 && !e1.message.includes("duplicate")) { setBusy(false); return toast.error(e1.message); }
    const { error: e2 } = await supabase.from("profiles").update({ upload_status: "approved" }).eq("id", userId);
    setBusy(false);
    if (e2) return toast.error(e2.message);
    toast.success("Utilizador aprovado!");
    load();
  };

  const reject = async (userId: string) => {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ upload_status: "rejected" }).eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pedido rejeitado.");
    load();
  };

  const revoke = async (userId: string) => {
    setBusy(true);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "uploader");
    if (!error) await supabase.from("profiles").update({ upload_status: "none" }).eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Permissão removida.");
    load();
  };

  const pending = profiles.filter((p) => p.upload_status === "pending");
  const others = profiles.filter((p) => p.upload_status !== "pending");

  const deleteMessage = async (id: string) => {
    if (!confirm("Eliminar definitivamente esta mensagem? Esta ação não pode ser desfeita.")) return;
    setBusy(true);
    const { error } = await supabase.from("contact_messages").delete().eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Mensagem eliminada.");
    load();
  };

  const toggleRead = async (m: ContactMsg) => {
    setBusy(true);
    const { error } = await supabase.from("contact_messages").update({ is_read: !m.is_read }).eq("id", m.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    load();
  };

  const openDetails = async (m: ContactMsg) => {
    setSelected(m);
    if (!m.is_read) {
      const { error } = await supabase.from("contact_messages").update({ is_read: true }).eq("id", m.id);
      if (!error) load();
    }
  };

  const approveTrack = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.from("tracks").update({ status: "approved" }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conteúdo aprovado e publicado.");
    load();
  };

  const rejectTrack = async (id: string) => {
    if (!confirm("Rejeitar este conteúdo? Ficará oculto da biblioteca.")) return;
    setBusy(true);
    const { error } = await supabase.from("tracks").update({ status: "rejected" }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conteúdo rejeitado.");
    load();
  };

  const openPreview = async (t: PendingTrack) => {
    setPreviewTrack(t);
    setPreviewPdfUrl(null);
    setPreviewAudioUrl(null);
    setPreviewImageUrls([]);
    const [pdfU, audU, imgUs] = await Promise.all([
      getSignedUrl("pdfs", t.pdf_path),
      t.audio_path ? getSignedUrl("audios", t.audio_path) : Promise.resolve(null),
      Promise.all((t.image_paths ?? []).map((p) => getSignedUrl("images", p))),
    ]);
    setPreviewPdfUrl(pdfU);
    setPreviewAudioUrl(audU);
    setPreviewImageUrls((imgUs ?? []).filter(Boolean) as string[]);
  };

  const sortedMessages = [...messages].sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    return sortDesc ? db - da : da - db;
  });
  const totalPages = Math.max(1, Math.ceil(sortedMessages.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageMessages = sortedMessages.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const unreadCount = messages.filter((m) => !m.is_read).length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-10 max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Administração</h1>
          <p className="text-muted-foreground">Gerir permissões de envio.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Conteúdos pendentes ({pendingTracks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingTracks.length === 0 && <p className="text-sm text-muted-foreground">Sem conteúdos a aprovar.</p>}
            {pendingTracks.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                    {t.author && <span>por {t.author}</span>}
                    <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                    <span>· {new Date(t.created_at).toLocaleString("pt-PT")}</span>
                  </div>
                  {t.description && <p className="mt-1 text-sm line-clamp-2">{t.description}</p>}
                  <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> PDF</span>
                    {t.audio_path && <span className="inline-flex items-center gap-1"><MusicIcon className="h-3 w-3" /> Áudio</span>}
                    {t.image_paths.length > 0 && <span>{t.image_paths.length} imagem(ns)</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => openPreview(t)}><Eye className="h-4 w-4 mr-1" />Ver</Button>
                  <Button size="sm" disabled={busy} onClick={() => approveTrack(t.id)}><Check className="h-4 w-4 mr-1" />Aprovar</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => rejectTrack(t.id)}><X className="h-4 w-4 mr-1" />Rejeitar</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Dialog open={!!previewTrack} onOpenChange={(o) => !o && setPreviewTrack(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{previewTrack?.title}</DialogTitle>
              <DialogDescription>
                {previewTrack?.author ? `por ${previewTrack.author} · ` : ""}{previewTrack?.category}
              </DialogDescription>
            </DialogHeader>
            {previewTrack && (
              <div className="space-y-4">
                {previewTrack.description && <p className="text-sm whitespace-pre-wrap">{previewTrack.description}</p>}
                {previewPdfUrl && (
                  <iframe src={previewPdfUrl} className="w-full h-[60vh] rounded border border-border" title="PDF" />
                )}
                {previewAudioUrl && <audio controls src={previewAudioUrl} className="w-full" />}
                {previewImageUrls.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {previewImageUrls.map((u) => <img key={u} src={u} alt="" className="rounded border border-border aspect-square w-full object-cover" />)}
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              {previewTrack && (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => { const id = previewTrack.id; setPreviewTrack(null); rejectTrack(id); }}>
                    <X className="h-4 w-4 mr-1" />Rejeitar
                  </Button>
                  <Button disabled={busy} onClick={() => { const id = previewTrack.id; setPreviewTrack(null); approveTrack(id); }}>
                    <Check className="h-4 w-4 mr-1" />Aprovar
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader><CardTitle>Pedidos pendentes ({pending.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 && <p className="text-sm text-muted-foreground">Sem pedidos pendentes.</p>}
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{p.display_name ?? p.email}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => approve(p.id)}><Check className="h-4 w-4 mr-1" />Aprovar</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => reject(p.id)}><X className="h-4 w-4 mr-1" />Rejeitar</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Mensagens recebidas ({messages.length})
                {unreadCount > 0 && <Badge variant="default">{unreadCount} não lidas</Badge>}
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => { setSortDesc((v) => !v); setPage(1); }}>
                <ArrowUpDown className="h-4 w-4 mr-1" />
                {sortDesc ? "Mais recentes" : "Mais antigas"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {messages.length === 0 && <p className="text-sm text-muted-foreground">Sem mensagens.</p>}
            {pageMessages.map((m) => (
              <div
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={() => openDetails(m)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetails(m); } }}
                className={`rounded-lg border p-3 space-y-2 cursor-pointer transition-colors hover:bg-muted/40 ${m.is_read ? "border-border bg-background" : "border-primary/40 bg-primary/5"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{m.name}</p>
                      {!m.is_read && <Badge variant="default" className="text-xs">Nova</Badge>}
                    </div>
                    {m.email && m.email !== "—" && <p className="text-xs text-muted-foreground break-all">{m.email}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-PT")}</p>
                  </div>
                  <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => toggleRead(m)} title={m.is_read ? "Marcar como não lida" : "Marcar como lida"}>
                      {m.is_read ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => deleteMessage(m.id)} title="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {m.subject && <p className="text-sm font-medium">{m.subject}</p>}
                <p className="text-sm whitespace-pre-wrap line-clamp-3">{m.message}</p>
              </div>
            ))}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4 mr-1" />Anterior
                </Button>
                <p className="text-xs text-muted-foreground">Página {currentPage} de {totalPages}</p>
                <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Próxima<ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selected?.name}</DialogTitle>
              <DialogDescription>
                {selected && new Date(selected.created_at).toLocaleString("pt-PT")}
              </DialogDescription>
            </DialogHeader>
            {selected && (
              <div className="space-y-3">
                {selected.email && selected.email !== "—" && (
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <a href={`mailto:${selected.email}`} className="text-sm break-all hover:text-primary">{selected.email}</a>
                  </div>
                )}
                {selected.subject && (
                  <div>
                    <p className="text-xs text-muted-foreground">Assunto</p>
                    <p className="text-sm font-medium">{selected.subject}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Mensagem</p>
                  <p className="text-sm whitespace-pre-wrap mt-1 rounded-md border border-border bg-muted/30 p-3 max-h-72 overflow-y-auto">{selected.message}</p>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              {selected && (
                <>
                  <Button variant="outline" onClick={() => toggleRead(selected)} disabled={busy}>
                    {selected.is_read ? <><Mail className="h-4 w-4 mr-1" />Marcar como não lida</> : <><MailOpen className="h-4 w-4 mr-1" />Marcar como lida</>}
                  </Button>
                  <Button variant="outline" onClick={() => { const id = selected.id; setSelected(null); deleteMessage(id); }} disabled={busy}>
                    <Trash2 className="h-4 w-4 mr-1" />Eliminar
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader><CardTitle>Todos os utilizadores</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {others.map((p) => {
              const rs = rolesByUser[p.id] ?? [];
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.display_name ?? p.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {rs.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
                      {p.upload_status !== "none" && <Badge variant="outline">{p.upload_status}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {rs.includes("uploader") ? (
                      <Button size="sm" variant="outline" disabled={busy || rs.includes("admin")} onClick={() => revoke(p.id)}>Revogar envio</Button>
                    ) : (
                      <Button size="sm" disabled={busy} onClick={() => approve(p.id)}>Conceder envio</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

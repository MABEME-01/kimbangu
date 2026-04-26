import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/app/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, X, Shield, Mail, Trash2, MailOpen, ArrowUpDown, ChevronLeft, ChevronRight, FileText, Eye, Music as MusicIcon, Tag, Plus, Pencil, Users, KeyRound, Inbox, ListChecks, FileCheck2 } from "lucide-react";
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
  created_at?: string;
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

const PAGE_SIZE = 25;

function initialsOf(name: string) {
  const parts = (name || "U").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/60 mt-3">
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4 mr-1" />Anterior
      </Button>
      <p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p>
      <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Seguinte<ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}

function AdminPage() {
  const { isAdmin, loading, user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, string[]>>({});
  const [messages, setMessages] = useState<ContactMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const [msgPage, setMsgPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [tracksPage, setTracksPage] = useState(1);
  const [usersQuery, setUsersQuery] = useState("");
  const [selected, setSelected] = useState<ContactMsg | null>(null);
  const [pendingTracks, setPendingTracks] = useState<PendingTrack[]>([]);
  const [previewTrack, setPreviewTrack] = useState<PendingTrack | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewImageUrls, setPreviewImageUrls] = useState<string[]>([]);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteUserTarget, setDeleteUserTarget] = useState<Profile | null>(null);
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

  const grantUploader = async (userId: string) => {
    setBusy(true);
    const { error: e1 } = await supabase.from("user_roles").insert({ user_id: userId, role: "uploader" });
    if (e1 && !e1.message.includes("duplicate")) { setBusy(false); return toast.error(e1.message); }
    const { error: e2 } = await supabase.from("profiles").update({ upload_status: "approved" }).eq("id", userId);
    setBusy(false);
    if (e2) return toast.error(e2.message);
    toast.success("Permissão concedida.");
    load();
  };
  const rejectRequest = async (userId: string) => {
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

  const sendPasswordReset = async (email: string) => {
    if (!email) return toast.error("Sem email registado.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) return toast.error(error.message);
    toast.success(`Email de recuperação enviado para ${email}.`);
  };

  const deleteUser = async () => {
    if (!deleteUserTarget) return;
    if (deleteUserTarget.id === currentUser?.id) {
      toast.error("Não pode eliminar a sua própria conta.");
      return;
    }
    setBusy(true);
    // Delete tracks (cascade through storage cleanup is manual in app); first delete history rows owned via tracks RLS, then profiles + user_roles
    const { error: rErr } = await supabase.from("user_roles").delete().eq("user_id", deleteUserTarget.id);
    if (rErr) { setBusy(false); return toast.error(rErr.message); }
    const { error: pErr } = await supabase.from("profiles").delete().eq("id", deleteUserTarget.id);
    setBusy(false);
    if (pErr) return toast.error(`Perfil eliminado parcialmente: ${pErr.message}`);
    toast.success("Utilizador removido do sistema. (A conta de autenticação só pode ser apagada via Backend.)");
    setDeleteUserTarget(null);
    load();
  };

  const pendingProfiles = profiles.filter((p) => p.upload_status === "pending");

  const deleteMessage = async (id: string) => {
    if (!confirm("Eliminar definitivamente esta mensagem?")) return;
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
    toast.success("Conteúdo aprovado.");
    load();
  };
  const openRejectDialog = (id: string, title: string) => { setRejectTarget({ id, title }); setRejectReason(""); };
  const confirmRejectTrack = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) return toast.error("Indique um motivo (mín. 3 caracteres).");
    if (reason.length > 500) return toast.error("Motivo muito longo.");
    setBusy(true);
    const { error } = await supabase.from("tracks").update({ status: "rejected", rejection_reason: reason }).eq("id", rejectTarget.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Rejeitado.");
    setRejectTarget(null); setRejectReason(""); setPreviewTrack(null);
    load();
  };

  const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  const createCategory = async () => {
    const label = newCatLabel.trim();
    if (label.length < 2 || label.length > 60) return toast.error("Nome inválido (2–60).");
    let value = slug(label);
    if (!value) return toast.error("Nome inválido.");
    if (categories.some((c) => c.label.toLowerCase() === label.toLowerCase())) return toast.error("Categoria já existe.");
    if (categories.some((c) => c.value === value)) value = `${value}-${Date.now().toString(36).slice(-4)}`;
    setBusy(true);
    const { error } = await supabase.from("categories").insert({ value, label });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Categoria criada.");
    setNewCatLabel(""); fetchCategories(true);
  };
  const renameCategory = async () => {
    if (!editCat) return;
    const label = editCatLabel.trim();
    if (label.length < 2 || label.length > 60) return toast.error("Nome inválido.");
    setBusy(true);
    const { error } = await supabase.from("categories").update({ label }).eq("value", editCat.value);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Renomeada.");
    setEditCat(null); fetchCategories(true);
  };
  const deleteCategory = async (value: string, label: string) => {
    const { count } = await supabase.from("tracks").select("id", { count: "exact", head: true }).eq("category", value);
    if ((count ?? 0) > 0) return toast.error(`Categoria em uso por ${count} hino(s).`);
    if (!confirm(`Eliminar a categoria "${label}"?`)) return;
    setBusy(true);
    const { error } = await supabase.from("categories").delete().eq("value", value);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Eliminada.");
    fetchCategories(true);
  };

  const openPreview = async (t: PendingTrack) => {
    setPreviewTrack(t);
    setPreviewPdfUrl(null); setPreviewAudioUrl(null); setPreviewImageUrls([]);
    const [pdfU, audU, imgUs] = await Promise.all([
      getSignedUrl("pdfs", t.pdf_path),
      t.audio_path ? getSignedUrl("audios", t.audio_path) : Promise.resolve(null),
      Promise.all((t.image_paths ?? []).map((p) => getSignedUrl("images", p))),
    ]);
    setPreviewPdfUrl(pdfU); setPreviewAudioUrl(audU);
    setPreviewImageUrls((imgUs ?? []).filter(Boolean) as string[]);
  };

  // Sorted/paginated views
  const sortedMessages = [...messages].sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    return sortDesc ? db - da : da - db;
  });
  const totalMsgPages = Math.max(1, Math.ceil(sortedMessages.length / PAGE_SIZE));
  const curMsgPage = Math.min(msgPage, totalMsgPages);
  const pageMessages = sortedMessages.slice((curMsgPage - 1) * PAGE_SIZE, curMsgPage * PAGE_SIZE);
  const unreadCount = messages.filter((m) => !m.is_read).length;

  const filteredUsers = useMemo(() => {
    const q = usersQuery.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      (p.email ?? "").toLowerCase().includes(q) || (p.display_name ?? "").toLowerCase().includes(q)
    );
  }, [profiles, usersQuery]);
  const totalUsersPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const curUsersPage = Math.min(usersPage, totalUsersPages);
  const pageUsers = filteredUsers.slice((curUsersPage - 1) * PAGE_SIZE, curUsersPage * PAGE_SIZE);

  const totalPendingPages = Math.max(1, Math.ceil(pendingProfiles.length / PAGE_SIZE));
  const curPendingPage = Math.min(pendingPage, totalPendingPages);
  const pagePending = pendingProfiles.slice((curPendingPage - 1) * PAGE_SIZE, curPendingPage * PAGE_SIZE);

  const totalTracksPages = Math.max(1, Math.ceil(pendingTracks.length / PAGE_SIZE));
  const curTracksPage = Math.min(tracksPage, totalTracksPages);
  const pageTracks = pendingTracks.slice((curTracksPage - 1) * PAGE_SIZE, curTracksPage * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Shield className="h-7 w-7 text-primary" />Administração</h1>
            <p className="text-muted-foreground text-sm">Gestão completa de utilizadores, conteúdos e categorias.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" />{profiles.length} utilizadores</Badge>
            {pendingTracks.length > 0 && <Badge className="gap-1"><FileCheck2 className="h-3 w-3" />{pendingTracks.length} a aprovar</Badge>}
            {unreadCount > 0 && <Badge variant="default" className="gap-1"><Inbox className="h-3 w-3" />{unreadCount} mensagens novas</Badge>}
          </div>
        </div>

        <Tabs defaultValue="tracks" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto justify-start gap-1 bg-muted/50 p-1">
            <TabsTrigger value="tracks" className="gap-1.5"><FileCheck2 className="h-4 w-4" />Conteúdos {pendingTracks.length > 0 && <Badge variant="default" className="h-5 ml-1">{pendingTracks.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="requests" className="gap-1.5"><ListChecks className="h-4 w-4" />Pedidos {pendingProfiles.length > 0 && <Badge variant="default" className="h-5 ml-1">{pendingProfiles.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" />Utilizadores</TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5"><Mail className="h-4 w-4" />Mensagens {unreadCount > 0 && <Badge variant="default" className="h-5 ml-1">{unreadCount}</Badge>}</TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5"><Tag className="h-4 w-4" />Categorias</TabsTrigger>
          </TabsList>

          {/* CONTEÚDOS PENDENTES */}
          <TabsContent value="tracks">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Conteúdos pendentes ({pendingTracks.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {pendingTracks.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Sem conteúdos a aprovar.</p>}
                {pageTracks.map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{t.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground items-center">
                        {t.author && <span>por {t.author}</span>}
                        <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                        <span>· {new Date(t.created_at).toLocaleString("pt-PT")}</span>
                      </div>
                      {t.description && <p className="mt-1 text-sm line-clamp-2">{t.description}</p>}
                      <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> PDF</span>
                        {t.audio_path && <span className="inline-flex items-center gap-1"><MusicIcon className="h-3 w-3" /> Áudio</span>}
                        {t.image_paths.length > 0 && <span>{t.image_paths.length} img</span>}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => openPreview(t)}><Eye className="h-4 w-4 mr-1" />Ver</Button>
                      <Button size="sm" disabled={busy} onClick={() => approveTrack(t.id)}><Check className="h-4 w-4 mr-1" />Aprovar</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => openRejectDialog(t.id, t.title)}><X className="h-4 w-4 mr-1" />Rejeitar</Button>
                    </div>
                  </div>
                ))}
                <Pager page={curTracksPage} totalPages={totalTracksPages} onChange={setTracksPage} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* PEDIDOS DE PERMISSÃO */}
          <TabsContent value="requests">
            <Card>
              <CardHeader><CardTitle>Pedidos de permissão de envio ({pendingProfiles.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {pendingProfiles.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Sem pedidos pendentes.</p>}
                {pagePending.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initialsOf(p.display_name ?? p.email ?? "U")}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.display_name ?? p.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => grantUploader(p.id)}><Check className="h-4 w-4 mr-1" />Aprovar</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => rejectRequest(p.id)}><X className="h-4 w-4 mr-1" />Rejeitar</Button>
                    </div>
                  </div>
                ))}
                <Pager page={curPendingPage} totalPages={totalPendingPages} onChange={setPendingPage} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* UTILIZADORES */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Utilizadores ({filteredUsers.length})</CardTitle>
                  <Input placeholder="Pesquisar por nome ou email..." value={usersQuery} onChange={(e) => { setUsersQuery(e.target.value); setUsersPage(1); }} className="w-full sm:w-64" maxLength={100} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {pageUsers.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum utilizador encontrado.</p>}
                {pageUsers.map((p) => {
                  const rs = rolesByUser[p.id] ?? [];
                  const isSelf = p.id === currentUser?.id;
                  const isAdminUser = rs.includes("admin");
                  return (
                    <div key={p.id} className="rounded-lg border border-border p-3 hover:bg-muted/30 transition">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{initialsOf(p.display_name ?? p.email ?? "U")}</AvatarFallback></Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate flex items-center gap-2">
                              {p.display_name ?? p.email}
                              {isSelf && <Badge variant="outline" className="text-[10px]">você</Badge>}
                            </p>
                            <p className="text-xs text-muted-foreground break-all">{p.email}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {rs.map((r) => <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-[10px]">{r}</Badge>)}
                              {p.upload_status !== "none" && <Badge variant="outline" className="text-[10px]">{p.upload_status}</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0 flex-wrap">
                          {rs.includes("uploader") ? (
                            <Button size="sm" variant="outline" disabled={busy || isAdminUser} onClick={() => revoke(p.id)}>Revogar envio</Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => grantUploader(p.id)}>Conceder envio</Button>
                          )}
                          <Button size="sm" variant="outline" disabled={busy || !p.email} onClick={() => sendPasswordReset(p.email!)} title="Enviar email de recuperação de palavra-passe">
                            <KeyRound className="h-3.5 w-3.5 mr-1" />Reset
                          </Button>
                          <Button size="sm" variant="destructive" disabled={busy || isSelf || isAdminUser} onClick={() => setDeleteUserTarget(p)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Pager page={curUsersPage} totalPages={totalUsersPages} onChange={setUsersPage} />
                <p className="text-xs text-muted-foreground italic pt-2">
                  ⚠ Por motivos de segurança, palavras-passe são guardadas encriptadas e <strong>não podem ser visualizadas</strong> por ninguém — nem mesmo pelo administrador. Use "Reset" para enviar um link de recuperação ao utilizador.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MENSAGENS */}
          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Mensagens ({messages.length}){unreadCount > 0 && <Badge>{unreadCount} novas</Badge>}</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => { setSortDesc((v) => !v); setMsgPage(1); }}>
                    <ArrowUpDown className="h-4 w-4 mr-1" />{sortDesc ? "Mais recentes" : "Mais antigas"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {messages.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Sem mensagens.</p>}
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
                          {!m.is_read && <Badge>Nova</Badge>}
                        </div>
                        {m.email && m.email !== "—" && <p className="text-xs text-muted-foreground break-all">{m.email}</p>}
                        <p className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-PT")}</p>
                      </div>
                      <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => toggleRead(m)}>
                          {m.is_read ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => deleteMessage(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {m.subject && <p className="text-sm font-medium">{m.subject}</p>}
                    <p className="text-sm whitespace-pre-wrap line-clamp-3">{m.message}</p>
                  </div>
                ))}
                <Pager page={curMsgPage} totalPages={totalMsgPages} onChange={setMsgPage} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* CATEGORIAS */}
          <TabsContent value="categories">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" />Categorias ({categories.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} placeholder="Nome da nova categoria" maxLength={60} />
                  <Button onClick={createCategory} disabled={busy || newCatLabel.trim().length < 2}>
                    <Plus className="h-4 w-4 mr-1" />Criar
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {categories.map((c) => (
                    <div key={c.value} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.label}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{c.value}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => { setEditCat(c); setEditCatLabel(c.label); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => deleteCategory(c.value, c.label)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview track */}
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
              {previewPdfUrl && <iframe src={previewPdfUrl} className="w-full h-[60vh] rounded border border-border" title="PDF" />}
              {previewAudioUrl && <audio controls src={previewAudioUrl} className="w-full" />}
              {previewImageUrls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {previewImageUrls.map((u) => <img key={u} src={u} alt="" className="rounded border border-border aspect-square w-full object-cover" />)}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            {previewTrack && (
              <>
                <Button variant="outline" disabled={busy} onClick={() => { const id = previewTrack.id; const title = previewTrack.title; setPreviewTrack(null); openRejectDialog(id, title); }}>
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

      {/* Reject reason */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar conteúdo</DialogTitle>
            <DialogDescription>{rejectTarget?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da rejeição *</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={500} rows={5} autoFocus placeholder="Mín. 3 caracteres." />
            <p className="text-xs text-muted-foreground">{rejectReason.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmRejectTrack} disabled={busy || rejectReason.trim().length < 3}>
              <X className="h-4 w-4 mr-1" />Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit category */}
      <Dialog open={!!editCat} onOpenChange={(o) => { if (!o) setEditCat(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear categoria</DialogTitle>
            <DialogDescription>O identificador interno ({editCat?.value}) não muda.</DialogDescription>
          </DialogHeader>
          <Input value={editCatLabel} onChange={(e) => setEditCatLabel(e.target.value)} maxLength={60} autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditCat(null)}>Cancelar</Button>
            <Button onClick={renameCategory} disabled={busy || editCatLabel.trim().length < 2}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message details */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>{selected && new Date(selected.created_at).toLocaleString("pt-PT")}</DialogDescription>
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
          <DialogFooter className="gap-2">
            {selected && (
              <>
                <Button variant="outline" onClick={() => toggleRead(selected)} disabled={busy}>
                  {selected.is_read ? <><Mail className="h-4 w-4 mr-1" />Marcar não lida</> : <><MailOpen className="h-4 w-4 mr-1" />Marcar lida</>}
                </Button>
                <Button variant="outline" onClick={() => { const id = selected.id; setSelected(null); deleteMessage(id); }} disabled={busy}>
                  <Trash2 className="h-4 w-4 mr-1" />Eliminar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete user confirmation */}
      <Dialog open={!!deleteUserTarget} onOpenChange={(o) => !o && setDeleteUserTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar utilizador</DialogTitle>
            <DialogDescription>
              Tem a certeza que quer remover <strong>{deleteUserTarget?.display_name ?? deleteUserTarget?.email}</strong> do sistema?
              <br /><br />
              Isto remove o perfil e as permissões. Os hinos enviados por este utilizador permanecem na biblioteca (pertencentes ao sistema).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteUserTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={deleteUser} disabled={busy}>
              <Trash2 className="h-4 w-4 mr-1" />Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

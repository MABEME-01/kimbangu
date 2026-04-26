import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/app/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, MapPin, Send, Phone } from "lucide-react";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contacte-nos — FLAUKI" },
      { name: "description", content: "Fale connosco: dúvidas, sugestões, pedidos para ser uploader ou colaborar com a Biblioteca Musical FLAUKI." },
    ],
  }),
});

const schema = z.object({
  name: z
    .string({ required_error: "Indique o seu nome", invalid_type_error: "Nome inválido" })
    .trim()
    .min(1, "Indique o seu nome")
    .max(100, "Nome demasiado longo (máx. 100)"),
  email: z
    .string()
    .trim()
    .max(255, "E-mail demasiado longo (máx. 255)")
    .email("E-mail inválido")
    .optional()
    .or(z.literal("")),
  message: z
    .string({ required_error: "Escreva uma mensagem", invalid_type_error: "Mensagem inválida" })
    .trim()
    .min(5, "Mensagem demasiado curta (mín. 5 caracteres)")
    .max(2000, "Mensagem demasiado longa (máx. 2000)"),
});

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Garantir que nunca enviamos null/undefined nem espaços apenas
    const safeName = (name ?? "").toString().replace(/\s+/g, " ").trim();
    const safeEmail = (email ?? "").toString().trim();
    const safeMessage = (message ?? "").toString().trim();

    if (!safeName || !safeMessage) {
      toast.error("Preencha o Nome e a Mensagem antes de enviar.");
      return;
    }

    const parsed = schema.safeParse({ name: safeName, email: safeEmail, message: safeMessage });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    // Salvaguarda final: confirmar que os campos validados existem
    if (!parsed.data.name || !parsed.data.message) {
      toast.error("Nome e Mensagem são obrigatórios.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("contact_messages")
      .insert({
        name: parsed.data.name,
        email: parsed.data.email && parsed.data.email.length > 0 ? parsed.data.email : null,
        subject: null,
        message: parsed.data.message,
      })
      .select("id")
      .single();
    setLoading(false);
    if (error || !data?.id) {
      return toast.error("Não foi possível enviar a sua mensagem. Tente novamente.", {
        description: error?.message,
      });
    }
    toast.success("Mensagem enviada com sucesso!", {
      description: "O administrador foi notificado e responderá em breve.",
    });
    setName("");
    setEmail("");
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="border-b border-border/40" style={{ background: "var(--gradient-hero)" }}>
        <div className="container mx-auto px-4 py-14 text-primary-foreground">
          <h1 className="text-3xl sm:text-4xl font-bold">Contacte-nos</h1>
          <p className="mt-3 max-w-2xl opacity-90">Tem dúvidas, sugestões ou quer colaborar com a Biblioteca Musical? Estamos a ouvir.</p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardContent className="p-5 flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Email</p>
                <a href="mailto:manobv511@gmail.com" className="text-sm text-muted-foreground hover:text-primary break-all">manobv511@gmail.com</a>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-start gap-3">
              <Phone className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">WhatsApp / Apoio</p>
                <a href="https://wa.me/244927800658" target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-primary block">+244 927 800 658</a>
                <p className="text-xs text-muted-foreground mt-0.5">Angola</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Comunidade</p>
                <p className="text-sm text-muted-foreground">Inspirada na tradição Kimbanguista — aberta a todos.</p>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground px-1">
            As mensagens enviadas por este formulário ficam disponíveis para o administrador da plataforma.
          </p>
        </div>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Envie a sua mensagem</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="c-name">Nome *</Label>
                <Input
                  id="c-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  placeholder="Ex.: Maria Silva"
                  required
                />
              </div>
              <div>
                <Label htmlFor="c-email">E-mail (opcional)</Label>
                <Input
                  id="c-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                  placeholder="ex.: voce@email.com"
                  autoComplete="email"
                />
                <p className="mt-1 text-xs text-muted-foreground">Indique o seu e-mail se desejar receber resposta.</p>
              </div>
              <div>
                <Label htmlFor="c-msg">Mensagem *</Label>
                <Textarea
                  id="c-msg"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  rows={6}
                  placeholder="Escreva aqui a sua dúvida, sugestão ou pedido…"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">{message.length}/2000</p>
              </div>
              <Button
                type="submit"
                disabled={loading || !name.trim() || message.trim().length < 5}
                className="w-full sm:w-auto"
              >
                <Send className="h-4 w-4 mr-2" /> {loading ? "A enviar..." : "Enviar mensagem"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

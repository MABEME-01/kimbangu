import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/app/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // sign in
  const [siEmail, setSiEmail] = useState("");
  const [siPass, setSiPass] = useState("");

  // sign up
  const [suEmail, setSuEmail] = useState("");
  const [suPass, setSuPass] = useState("");
  const [suName, setSuName] = useState("");

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPass });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo!");
    navigate({ to: "/" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: suEmail,
      password: suPass,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: suName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Já pode iniciar sessão.");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto flex items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md shadow-[var(--shadow-elegant)]">
          <CardHeader>
            <CardTitle className="text-2xl">Acesso à FLAUKI</CardTitle>
            <p className="text-sm text-muted-foreground">
              Entre ou crie a sua conta para enviar conteúdos.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Registar</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="si-email">E-mail</Label>
                    <Input id="si-email" type="email" required value={siEmail} onChange={(e) => setSiEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="si-pass">Palavra-passe</Label>
                    <Input id="si-pass" type="password" required value={siPass} onChange={(e) => setSiPass(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "A entrar..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="su-name">Nome</Label>
                    <Input id="su-name" required value={suName} onChange={(e) => setSuName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="su-email">E-mail</Label>
                    <Input id="su-email" type="email" required value={suEmail} onChange={(e) => setSuEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="su-pass">Palavra-passe</Label>
                    <Input id="su-pass" type="password" required minLength={6} value={suPass} onChange={(e) => setSuPass(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "A criar..." : "Criar conta"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Após criar conta, peça permissão de upload em <Link to="/upload" className="underline">Enviar</Link>.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

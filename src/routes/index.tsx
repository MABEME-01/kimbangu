import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/app/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Library, Music2, Heart, BookOpenCheck, ArrowRight, Mail, Upload } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "FLAUKI — Biblioteca Musical Espiritual" },
      { name: "description", content: "Plataforma de partituras, áudios e imagens religiosas inspirada na tradição Kimbanguista. Acesso aberto a todos os fiéis." },
    ],
  }),
});

function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="relative overflow-hidden border-b border-border/40" style={{ background: "var(--gradient-hero)" }}>
        <div className="container mx-auto px-4 py-20 sm:py-28 text-primary-foreground">
          <p className="text-sm uppercase tracking-[0.2em] opacity-90">Biblioteca Musical · FLAUKI</p>
          <h1 className="mt-3 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight max-w-3xl">
            Música, palavra e oração — num só lugar.
          </h1>
          <p className="mt-5 max-w-2xl text-base sm:text-lg opacity-90">
            A Biblioteca - FLAUKI reúne hinos em partituras, áudios e imagens de cânticos de Deus para acompanhar o seu tempo de adoração, louvor e meditação. Inspirada na tradição Kimbanguista, oferecendo um espaço sereno para aprender e partilhar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/library">Explorar a Biblioteca <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-background/10 border-primary-foreground/30 text-primary-foreground hover:bg-background/20" asChild>
              <a href="https://partisolfa.lovable.app" target="_blank" rel="noreferrer">Visitar Partisolfa</a>
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: "var(--primary-glow)" }} />
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Library, title: "Partituras organizadas", text: "Encontre cânticos por categoria: alegria, adoração, louvor, súplicas e mais." },
            { icon: Music2, title: "Áudios para escutar", text: "Reproduza referências em MP3 enquanto acompanha a partitura." },
            { icon: Heart, title: "Devoção partilhada", text: "Uma comunidade de uploaders aprovados mantém o acervo vivo e curado." },
          ].map(({ icon: Icon, title, text }) => (
            <Card key={title} className="border-border/60">
              <CardContent className="p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl mb-4" style={{ background: "var(--gradient-primary)" }}>
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-muted/30">
        <div className="container mx-auto px-4 py-14 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold">Como navegar pela FLAUKI</h2>
            <p className="mt-3 text-muted-foreground">
              Não precisa de conta para ouvir e ver os conteúdos. O acesso anónimo é o padrão — basta abrir e explorar.
              Para enviar novos conteúdos, registe-se e peça permissão ao administrador.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild><Link to="/library"><Library className="h-4 w-4 mr-2" /> Ir à Biblioteca</Link></Button>
              <Button variant="outline" asChild><Link to="/contact"><Mail className="h-4 w-4 mr-2" /> Contacte-nos</Link></Button>
            </div>
          </div>
          <ul className="space-y-3">
            {[
              "Pesquise pelo título do cântico ou filtre por categoria.",
              "Abra um conteúdo para ler o PDF, ouvir o áudio e ver as imagens.",
              "Use o menu lateral (canto superior esquerdo) para mudar de página.",
              "Se for uploader aprovado, envie novos conteúdos pela área de envio.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background p-4">
                <BookOpenCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span className="text-sm">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold">Quer contribuir com um cântico?</h2>
              <p className="mt-2 text-muted-foreground max-w-xl">
                Partilhe partituras, áudios e imagens com a comunidade. Os envios são revistos pelo administrador antes de serem publicados.
              </p>
            </div>
            <Button size="lg" asChild className="shrink-0">
              <Link to="/upload"><Upload className="h-5 w-5 mr-2" />Enviar conteúdo</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        FLAUKI — Biblioteca Musical · Conteúdos religiosos com devoção
      </footer>
    </div>
  );
}

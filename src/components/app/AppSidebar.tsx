import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Home, Library, Music2, Mail, ExternalLink, Upload } from "lucide-react";
import { useState } from "react";

export function AppSidebar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Abrir menu"
          className="gap-2 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/60 shadow-sm transition relative"
        >
          <Menu className="h-5 w-5" />
          <span className="hidden sm:inline font-medium">Menu</span>
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary animate-pulse sm:hidden" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle className="text-left text-xl">FLAUKI</SheetTitle>
          <SheetDescription className="text-left text-sm">Biblioteca Musical Virtual</SheetDescription>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-2 px-2">
          <Link to="/" onClick={close} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-base font-medium shadow-sm hover:shadow-[var(--shadow-elegant)] hover:border-primary/40 hover:-translate-y-0.5 transition">
            <Home className="h-5 w-5 text-primary" /> Página Inicial
          </Link>
          <Link to="/library" onClick={close} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-base font-medium shadow-sm hover:shadow-[var(--shadow-elegant)] hover:border-primary/40 hover:-translate-y-0.5 transition">
            <Library className="h-5 w-5 text-primary" /> Biblioteca Musical
          </Link>
          <Link to="/upload" onClick={close} className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-base font-medium shadow-sm hover:shadow-[var(--shadow-elegant)] hover:border-primary/60 hover:-translate-y-0.5 transition">
            <Upload className="h-5 w-5 text-primary" /> Enviar conteúdo
          </Link>
          <a
            href="https://partisolfa.lovable.app"
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-base font-medium shadow-sm hover:shadow-[var(--shadow-elegant)] hover:border-primary/40 hover:-translate-y-0.5 transition"
          >
            <span className="flex items-center gap-3"><Music2 className="h-5 w-5 text-primary" /> Partisolfa</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
          <Link to="/contact" onClick={close} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-base font-medium shadow-sm hover:shadow-[var(--shadow-elegant)] hover:border-primary/40 hover:-translate-y-0.5 transition">
            <Mail className="h-5 w-5 text-primary" /> Contacte-nos
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

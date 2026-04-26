import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Library, Upload, Shield, LogIn, LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app/AppSidebar";

export function Header() {
  const { user, isAdmin, canUpload, signOut } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("flauki-theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("flauki-theme", next ? "dark" : "light");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <AppSidebar />
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
              <Library className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="hidden sm:inline text-lg tracking-tight">FLAUKI</span>
          </Link>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Alternar tema">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button size="sm" asChild className="shadow-sm">
            <Link to="/upload"><Upload className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Enviar conteúdo</span></Link>
          </Button>
          {isAdmin && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin"><Shield className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Admin</span></Link>
            </Button>
          )}
          {user ? (
            <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Sair</span>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/auth"><LogIn className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Entrar</span></Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
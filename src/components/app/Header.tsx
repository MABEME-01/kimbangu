import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Library, Upload, Shield, LogIn, LogOut, Moon, Sun, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app/AppSidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("flauki-theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  useEffect(() => {
    if (!user) { setDisplayName(""); return; }
    supabase.from("profiles").select("display_name,email").eq("id", user.id).maybeSingle().then(({ data }) => {
      setDisplayName((data?.display_name ?? data?.email ?? user.email ?? "Utilizador") as string);
    });
  }, [user?.id]);

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
            <Link to="/upload"><Upload className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Enviar</span></Link>
          </Button>
          {isAdmin && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin"><Shield className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Admin</span></Link>
            </Button>
          )}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 pl-1 pr-2 sm:pr-3 py-1 hover:bg-accent transition"
                  aria-label="Conta"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {initialsOf(displayName || user.email || "U")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate">
                    {displayName || user.email}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{displayName || "Utilizador"}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    {isAdmin && <p className="text-[10px] uppercase tracking-wider text-primary mt-0.5">Administrador</p>}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
                  <LogOut className="h-4 w-4 mr-2" />Terminar sessão
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
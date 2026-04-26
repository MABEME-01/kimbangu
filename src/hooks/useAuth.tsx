import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "admin" | "uploader" | "user";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  roles: Role[];
  uploadStatus: string;
  loading: boolean;
  isAdmin: boolean;
  canUpload: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string>("none");
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: rolesData }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("upload_status").eq("id", uid).maybeSingle(),
    ]);
    setRoles(((rolesData ?? []).map((r) => r.role)) as Role[]);
    setUploadStatus(profile?.upload_status ?? "none");
  };

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setRoles([]);
        setUploadStatus("none");
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = roles.includes("admin");
  const canUpload = isAdmin || roles.includes("uploader");

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    roles,
    uploadStatus,
    loading,
    isAdmin,
    canUpload,
    signOut: async () => { await supabase.auth.signOut(); },
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
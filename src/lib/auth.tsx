import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, isDemo } from "./supabase";
import { useQueryClient } from "@tanstack/react-query";
import { demoUser, setDemoRole, type DemoRole } from "./demo-api";
import type { Profile } from "./database.types";

type AuthState = {
  status: "loading" | "signed-out" | "signed-in";
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  isDemo: boolean;
  /** Demo mode only: which persona is being viewed. */
  demoRole: DemoRole;
  switchDemoRole: (r: DemoRole) => void;
  signIn: (email: string, password: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [demoRole, setRole] = useState<DemoRole>("manager");
  const qc = useQueryClient();

  useEffect(() => {
    if (!supabase) {
      let role: DemoRole = "manager";
      try { if (sessionStorage.getItem("demo-role") === "client") role = "client"; } catch { /* storage unavailable */ }
      setDemoRole(role);
      const u = demoUser(role);
      setRole(role);
      setUserId(u.id);
      setEmail(u.email);
      setProfile({ id: u.id, full_name: u.full_name, avatar_url: null, account_type: role });
      setStatus("signed-in");
      return;
    }
    const client = supabase;
    const apply = async (uid: string | null, mail: string | null) => {
      setUserId(uid);
      setEmail(mail);
      if (!uid) {
        setProfile(null);
        setStatus("signed-out");
        return;
      }
      const { data } = await client.from("profiles").select("id, full_name, avatar_url, account_type").eq("id", uid).maybeSingle();
      setProfile((data as Profile) ?? null);
      setStatus("signed-in");
    };
    client.auth.getSession().then(({ data }) => apply(data.session?.user.id ?? null, data.session?.user.email ?? null));
    const { data: sub } = client.auth.onAuthStateChange((_e, session) => {
      void apply(session?.user.id ?? null, session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const switchDemoRole = useCallback((role: DemoRole) => {
    try { sessionStorage.setItem("demo-role", role); } catch { /* storage unavailable */ }
    setDemoRole(role);
    const u = demoUser(role);
    setRole(role);
    setUserId(u.id);
    setEmail(u.email);
    setProfile({ id: u.id, full_name: u.full_name, avatar_url: null, account_type: role });
    qc.clear();
  }, [qc]);

  const signIn = useCallback(async (mail: string, password: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
    if (error) throw new Error(error.message);
  }, []);

  const sendMagicLink = useCallback(async (mail: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      email: mail,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ status, userId, email, profile, isDemo, demoRole, switchDemoRole, signIn, sendMagicLink, signOut }),
    [status, userId, email, profile, demoRole, switchDemoRole, signIn, sendMagicLink, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, isDemo } from "./supabase";
import { DEMO_USER } from "./demo-api";
import type { Profile } from "./database.types";

type AuthState = {
  status: "loading" | "signed-out" | "signed-in";
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  isDemo: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Save first + last name (stored as profiles.full_name) and optionally a new or removed photo. */
  saveProfile: (input: { firstName: string; lastName: string; photo?: File | null }) => Promise<void>;
  /** Supabase sends a confirmation link; the new address applies once it is confirmed. */
  changeEmail: (email: string) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!supabase) {
      setUserId(DEMO_USER.id);
      setEmail(DEMO_USER.email);
      setProfile({ id: DEMO_USER.id, full_name: DEMO_USER.full_name, avatar_url: null, account_type: "manager" });
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

  const saveProfile = useCallback<AuthState["saveProfile"]>(
    async ({ firstName, lastName, photo }) => {
      if (!userId) throw new Error("Not signed in");
      const full_name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      let avatar_url = profile?.avatar_url ?? null;
      if (photo === null) avatar_url = null;
      if (!supabase) {
        if (photo) avatar_url = URL.createObjectURL(photo);
        setProfile((p) => (p ? { ...p, full_name, avatar_url } : p));
        return;
      }
      if (photo) {
        const ext = /\.([a-z0-9]+)$/i.exec(photo.name)?.[1]?.toLowerCase() ?? "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("avatars").upload(path, photo, { contentType: photo.type || undefined });
        if (up.error) throw new Error(up.error.message);
        avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("profiles").update({ full_name, avatar_url }).eq("id", userId);
      if (error) throw new Error(error.message);
      setProfile((p) => (p ? { ...p, full_name, avatar_url } : p));
    },
    [userId, profile?.avatar_url],
  );

  const changeEmail = useCallback(async (mail: string) => {
    if (!supabase) throw new Error("The demo can't change sign-in details.");
    const { error } = await supabase.auth.updateUser({ email: mail }, { emailRedirectTo: window.location.origin });
    if (error) throw new Error(error.message);
  }, []);

  const changePassword = useCallback(async (password: string) => {
    if (!supabase) throw new Error("The demo can't change sign-in details.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo(
    () => ({ status, userId, email, profile, isDemo, signIn, sendMagicLink, signOut, saveProfile, changeEmail, changePassword }),
    [status, userId, email, profile, signIn, sendMagicLink, signOut, saveProfile, changeEmail, changePassword],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

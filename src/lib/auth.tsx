// Sessions (T21). The Supabase session lives in cookies (see lib/supabase/browser.ts), so the
// server knows who is signed in on a hard load:
//
//   root beforeLoad → context.session.load() → getSession() (server fn, cookies + getClaims)
//                   → router context `auth: { user, profile }` → route guards + useAuth()
//
// On the server the store is per request (the router is). In the browser it starts from the
// server's value (router dehydrate/hydrate, so no extra round trip) and is reset by <AuthSync />
// whenever Supabase reports a different user, which re-runs the guards via router.invalidate().
import { useQueryClient } from "@tanstack/react-query";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { migrateLegacySession, supabase } from "./supabase";
import type { Profile } from "./database.types";
import { updateUserLocale } from "@/features/auth/hooks";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, matchLocale, readCookie } from "@/i18n";
import { getSession, type Session } from "@/server/functions/session";

export type { Session } from "@/server/functions/session";

/** The router context's session holder: one per router (= per request on the server). */
export type SessionStore = {
  /** The cached session, or undefined until loaded. */
  get(): Session | undefined;
  set(session: Session): void;
  /** Forget the cached session; the next load() asks the server again. */
  reset(): void;
  /** The cached session, or getSession() from the server (deduplicated). */
  load(): Promise<Session>;
};

export function createSessionStore(fetchSession: () => Promise<Session> = () => getSession()): SessionStore {
  let current: Session | undefined;
  let inflight: Promise<Session> | undefined;
  let generation = 0;
  return {
    get: () => current,
    set: (session) => {
      current = session;
    },
    reset: () => {
      current = undefined;
      inflight = undefined;
      generation += 1;
    },
    load: () => {
      if (current) return Promise.resolve(current);
      if (!inflight) {
        const started = generation;
        inflight = fetchSession().then(
          (session) => {
            if (started === generation) {
              current = session;
              inflight = undefined;
            }
            return session;
          },
          (error: unknown) => {
            if (started === generation) inflight = undefined;
            throw error;
          },
        );
      }
      return inflight;
    },
  };
}

type AuthState = {
  status: "signed-out" | "signed-in";
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

async function sendMagicLink(email: string) {
  // The link lands on /login (a public route), where the browser client exchanges the PKCE code
  // and AuthSync then sends the now signed-in user on.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/login` },
  });
  if (error) throw new Error(error.message);
}

async function signOut() {
  await supabase.auth.signOut();
}

/** The session from the router context (set by the root route's beforeLoad), plus the auth actions. */
export function useAuth(): AuthState {
  const auth = useRouteContext({ from: "__root__", select: (context) => context.auth });
  const user = auth?.user ?? null;
  const profile = user && auth?.profile ? { id: user.id, ...auth.profile } : null;
  return {
    status: user ? "signed-in" : "signed-out",
    userId: user?.id ?? null,
    email: user?.email ?? null,
    profile: profile as Profile | null,
    signIn,
    sendMagicLink,
    signOut,
  };
}

/** Supabase auth events that may mean "a different user (or none) now" and so re-run the guards. */
const SESSION_EVENTS = new Set(["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "MFA_CHALLENGE_VERIFIED"]);

/**
 * Keeps the router context in step with the browser's Supabase session: on sign-in, sign-out, a
 * profile change or an MFA step-up it drops the cached session and every cached query (they belong
 * to the previous user) and invalidates the router, so the root beforeLoad asks the server again and
 * the guards re-run (/login → the redirect target; protected pages → /login). Also migrates a pre-T21
 * localStorage session once. Mounted once, in the root component.
 */
export function AuthSync() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const session = router.options.context.session as SessionStore;
    const refresh = async () => {
      session.reset();
      queryClient.clear();
      await router.invalidate();
    };
    let subscription: { unsubscribe: () => void } | undefined;
    try {
      ({
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, next) => {
        if (!SESSION_EVENTS.has(event)) return;
        // Backfill user_metadata.locale once after sign-in when it's missing (older accounts, or a
        // locale chosen before ever signing in), so hosted auth emails render in the right language.
        if (event === "SIGNED_IN" && next?.user && !isLocale((next.user.user_metadata as { locale?: unknown })?.locale)) {
          const locale = matchLocale(readCookie(document.cookie, LOCALE_COOKIE)) ?? DEFAULT_LOCALE;
          void updateUserLocale(locale).catch(() => {});
        }
        const known = session.get();
        const nextId = next?.user.id ?? null;
        // SIGNED_IN also fires when the client restores the session it already had (tab focus, init).
        if (known && event === "SIGNED_IN" && known.user?.id === nextId) return;
        if (known && event === "SIGNED_OUT" && !known.user) return;
        // Outside the callback: supabase-js holds its auth lock while it runs.
        setTimeout(() => void refresh(), 0);
      }));
    } catch {
      return; // unconfigured Supabase: nothing to sync (the configuration error shows elsewhere)
    }
    void migrateLegacySession();
    return () => subscription?.unsubscribe();
  }, [router, queryClient]);
  return null;
}

// Sessions (T21). The Supabase session lives in cookies (see lib/supabase/browser.ts), so the
// server knows who is signed in on a hard load:
//
//   root beforeLoad → context.session.load() → getSession() (server fn, cookies + getClaims)
//                   → router context `auth: { user, profile }` → route guards + useAuth()
//
// On the server the store is per request (the router is). In the browser it starts from the
// server's value (router dehydrate/hydrate, so no extra round trip) and is reset by <AuthSync />
// whenever Supabase reports a different user, which re-runs the guards via router.invalidate().
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
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
  /** The session's assurance level: "aal2" once 2FA was verified in this session. */
  aal: "aal1" | "aal2" | null;
  profile: Profile | null;
  signOut: () => Promise<void>;
};

async function signOut() {
  await supabase.auth.signOut();
}

/**
 * The session from the router context (set by the root route's beforeLoad), plus sign-out. Signing
 * in, magic links, password reset and 2FA live in features/auth (hooks + ui).
 */
export function useAuth(): AuthState {
  const auth = useRouteContext({ from: "__root__", select: (context) => context.auth });
  const user = auth?.user ?? null;
  const profile = user && auth?.profile ? { id: user.id, ...auth.profile } : null;
  return {
    status: user ? "signed-in" : "signed-out",
    userId: user?.id ?? null,
    email: user?.email ?? null,
    aal: user?.aal ?? null,
    profile: profile as Profile | null,
    signOut,
  };
}

type RouterLike = { options: { context: unknown }; invalidate: () => Promise<void> };

async function refreshSession(router: RouterLike, queryClient: QueryClient) {
  (router.options.context as { session: SessionStore }).session.reset();
  queryClient.clear();
  await router.invalidate();
}

/**
 * Re-reads the session from the server now: drops the cached session and every cached query, then
 * re-runs the root beforeLoad and the guards. AuthSync does this on auth events; call it yourself
 * when the next navigation needs the new context (right after a 2FA verification, so the guards see
 * aal2) or after changing what getSession returns (the profile's name or photo).
 */
export function useSessionRefresh(): () => Promise<void> {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useCallback(() => refreshSession(router, queryClient), [router, queryClient]);
}

/**
 * Copies the signed-in user's saved language (`profiles.locale`; the cookie or pl if the profile
 * couldn't be read) onto `user_metadata.locale` when it differs. Best-effort: a failure only means a
 * hosted auth email may use the previous language.
 */
async function syncAuthLocale(session: SessionStore, metadataLocale: unknown): Promise<void> {
  try {
    const current = await session.load();
    if (!current.user) return;
    const locale = matchLocale(current.profile?.locale) ?? matchLocale(readCookie(document.cookie, LOCALE_COOKIE)) ?? DEFAULT_LOCALE;
    if (!isLocale(metadataLocale) || metadataLocale !== locale) await updateUserLocale(locale);
  } catch {
    // best-effort
  }
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
    const refresh = () => refreshSession(router, queryClient);
    let subscription: { unsubscribe: () => void } | undefined;
    try {
      ({
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, next) => {
        if (!SESSION_EVENTS.has(event)) return;
        // After a sign-in, mirror the saved language (profiles.locale) onto user_metadata.locale when
        // they differ (older accounts had none), so hosted auth emails render in the right language.
        const metadataLocale = (next?.user?.user_metadata as { locale?: unknown } | undefined)?.locale;
        const syncLocale = () => {
          if (event === "SIGNED_IN" && next?.user) void syncAuthLocale(session, metadataLocale);
        };
        const known = session.get();
        const nextId = next?.user.id ?? null;
        // Outside the callback: supabase-js holds its auth lock while it runs.
        // SIGNED_IN also fires when the client restores the session it already had (tab focus, init).
        if (known && event === "SIGNED_IN" && known.user?.id === nextId) return void setTimeout(syncLocale, 0);
        if (known && event === "SIGNED_OUT" && !known.user) return;
        setTimeout(() => void refresh().then(syncLocale), 0);
      }));
    } catch {
      return; // unconfigured Supabase: nothing to sync (the configuration error shows elsewhere)
    }
    void migrateLegacySession();
    return () => subscription?.unsubscribe();
  }, [router, queryClient]);
  return null;
}

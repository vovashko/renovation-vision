// The client every features/<f>/data repository uses (via `@/lib/supabase`), acting AS THE USER so
// Postgres RLS decides what they can see:
// - in the browser, @supabase/ssr's createBrowserClient, which keeps the session in COOKIES (not
//   localStorage), so the server can read the same session on a hard load;
// - during SSR (route loaders prefetching into the query cache), the current request's cookie
//   client from ./server (one per request, the same one getSession and server functions use).
//   That half is a createIsomorphicFn `.server()` branch, which the Start compiler strips from the
//   browser bundle together with the ./server import.
// Server functions use `./server` directly, or `./admin` (bypasses RLS, src/server/** only).
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createIsomorphicFn } from "@tanstack/react-start";
import { createServerSupabase } from "./server";
import { legacyStorageKey, SESSION_COOKIE_OPTIONS } from "./cookies";
import { readPublicSupabaseEnv, validateSupabaseEnv } from "./env";

/**
 * A client that throws a clear, readable error the first time it is used, instead of at
 * import time. This keeps a missing or malformed configuration from crashing SSR or the module
 * graph — the error only surfaces once something actually tries to talk to Supabase, where the
 * root route's error boundary can render it.
 */
function unconfiguredClient(message: string): SupabaseClient {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined; // never treat this as a thenable
        throw new Error(message);
      },
    },
  ) as SupabaseClient;
}

function createConfiguredClient(): SupabaseClient {
  const result = validateSupabaseEnv(readPublicSupabaseEnv());
  if (!result.ok) return unconfiguredClient(result.message);
  // A singleton reading/writing document.cookie.
  return createBrowserClient(result.env.url, result.env.key, { cookieOptions: SESSION_COOKIE_OPTIONS });
}

/** Server: the current request's cookie client. (Never called in the browser.) */
const requestClient = createIsomorphicFn()
  .server(() => createServerSupabase() as unknown as SupabaseClient)
  .client((): SupabaseClient => {
    throw new Error("requestClient is server-only");
  });

/**
 * On the server the module is shared by every request, so `supabase` is a stand-in that resolves
 * the request's own client on each property access (and throws outside a request).
 */
function requestBoundClient(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      if (prop === "then") return undefined;
      const client = requestClient();
      const value: unknown = Reflect.get(client, prop);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}

/** Same Supabase project as the RenoVision client app. Always defined; throws on use when unconfigured. */
export const supabase: SupabaseClient = typeof window === "undefined" ? requestBoundClient() : createConfiguredClient();

export const MEDIA_BUCKET = "project-media";
export const INTERNAL_BUCKET = "project-internal";

/**
 * One-time migration of a pre-T21 session: supabase-js used to keep it in localStorage, which the
 * server can't see. If there is no cookie session yet but an old localStorage one exists, hand its
 * tokens to the cookie client (setSession refreshes an expired access token) and drop the old copy.
 * Resolves true when a session was migrated. Browser only; a no-op on the server.
 */
export async function migrateLegacySession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const env = validateSupabaseEnv(readPublicSupabaseEnv());
  if (!env.ok) return false;
  const key = legacyStorageKey(env.env.url);
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return false; // storage blocked
  }
  if (!raw) return false;
  window.localStorage.removeItem(key);
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) return false; // already signed in with a cookie session
    const old = JSON.parse(raw) as { access_token?: unknown; refresh_token?: unknown };
    if (typeof old.access_token !== "string" || typeof old.refresh_token !== "string") return false;
    const { error } = await supabase.auth.setSession({ access_token: old.access_token, refresh_token: old.refresh_token });
    return !error;
  } catch {
    return false; // a corrupt or revoked old session: the user simply signs in again
  }
}

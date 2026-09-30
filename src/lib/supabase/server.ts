// Server-side Supabase clients that act AS THE USER: they use the publishable key plus the user's
// JWT, so Postgres RLS applies exactly as it does in the browser. Create one per request; never
// share one between requests (it carries that request's user).
//
// SERVER-ONLY (import protection fails the client build if the browser graph imports this).
// For privileged work that must bypass RLS, see ./admin (src/server/** only).
import "@tanstack/react-start/server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCookies, setCookie } from "@tanstack/react-start/server";
import type { Database } from "@/domain/db.types";
import { getPublicEnv } from "@/lib/env";

export type ServerSupabase = SupabaseClient<Database>;

const NO_BROWSER_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

/**
 * A per-request client acting as the user.
 *
 * - `{ accessToken }` (a verified JWT from an `Authorization: Bearer` header): every PostgREST,
 *   Storage and RPC call sends that token, so RLS sees `auth.uid()` = the token's `sub`.
 * - no token: reads (and on refresh, writes) the Supabase session cookies through TanStack Start's
 *   `getCookies`/`setCookie`, via `@supabase/ssr`. Today sessions live in localStorage, so there
 *   are no such cookies yet; this is the path T21's cookie sessions will use.
 *
 * Must run inside a request (it touches the request's cookies).
 */
export function createServerSupabase(options: { accessToken?: string } = {}): ServerSupabase {
  const { url, key } = getPublicEnv();
  if (options.accessToken) {
    return createClient<Database>(url, key, {
      auth: NO_BROWSER_SESSION,
      global: { headers: { Authorization: `Bearer ${options.accessToken}` } },
    });
  }
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => Object.entries(getCookies()).map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value, options: cookieOptions } of cookies) {
          setCookie(name, value, cookieOptions as Parameters<typeof setCookie>[2]);
        }
      },
    },
  });
}

let verifier: { client: ServerSupabase; url: string; key: string } | undefined;

/**
 * A long-lived, session-less client used only to verify access tokens with
 * `auth.getClaims(token)`. Shared per isolate on purpose: supabase-js caches the project's JWKS
 * (`/auth/v1/.well-known/jwks.json`, 10 min TTL) on the client instance, so asymmetric (ES256/RS256)
 * tokens are verified locally with WebCrypto without a network round trip per request. Tokens
 * signed with a symmetric (HS256) secret can't be verified locally; supabase-js then falls back to
 * `auth.getUser(token)`, one call to the Auth server. Never use it to query data.
 */
export function getJwtVerifier(): ServerSupabase {
  const { url, key } = getPublicEnv();
  if (!verifier || verifier.url !== url || verifier.key !== key) {
    verifier = { client: createClient<Database>(url, key, { auth: NO_BROWSER_SESSION }), url, key };
  }
  return verifier.client;
}

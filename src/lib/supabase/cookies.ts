// Attributes of the Supabase session cookies, shared by the browser client (which writes them with
// document.cookie) and the server's cookie client (which rewrites them when it refreshes a token).
// Not HttpOnly on purpose: @supabase/ssr's browser client must read the session from
// document.cookie to call Supabase directly. See README → Sessions & route guards.
export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax",
  secure: import.meta.env.PROD,
} as const;

/**
 * The key supabase-js used for the localStorage session before T21 (`sb-<first host label>-auth-token`,
 * e.g. `sb-127-auth-token` for the local stack). @supabase/ssr names its cookie the same way.
 */
export function legacyStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

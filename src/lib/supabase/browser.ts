// The browser Supabase client: supabase-js with the user's session in localStorage, so every
// request carries the user's JWT and Postgres RLS decides what they can see. This is what every
// features/<f>/data repository uses (via `@/lib/supabase`). Server code uses `./server` (acting as
// the user) or `./admin` (bypasses RLS, src/server/** only) instead.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readPublicSupabaseEnv, validateSupabaseEnv } from "./env";

/**
 * A client that throws a clear, readable error the first time it is used, instead of at
 * import time. This keeps a missing or malformed configuration from crashing SSR or the module
 * graph — the error only surfaces once something actually tries to talk to Supabase (e.g.
 * AuthProvider's effect), where the root route's error boundary can render it.
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
  return createClient(result.env.url, result.env.key, {
    auth: { persistSession: typeof window !== "undefined", autoRefreshToken: true, detectSessionInUrl: true },
  });
}

/** Same Supabase project as the RenoVision client app. Always defined; throws on use when unconfigured. */
export const supabase: SupabaseClient = createConfiguredClient();

export const MEDIA_BUCKET = "project-media";
export const INTERNAL_BUCKET = "project-internal";

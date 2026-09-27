import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const SUPABASE_CONFIG_ERROR =
  "Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see README → Local Supabase).";

/**
 * A client that throws a clear, readable error the first time it is used, instead of at
 * import time. This keeps a missing configuration from crashing SSR or the module graph —
 * the error only surfaces once something actually tries to talk to Supabase (e.g. AuthProvider's
 * effect), where the root route's error boundary can render it.
 */
function unconfiguredClient(): SupabaseClient {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined; // never treat this as a thenable
        throw new Error(SUPABASE_CONFIG_ERROR);
      },
    },
  ) as SupabaseClient;
}

function createConfiguredClient(): SupabaseClient {
  if (!url || !key) return unconfiguredClient();
  return createClient(url, key, {
    auth: { persistSession: typeof window !== "undefined", autoRefreshToken: true, detectSessionInUrl: true },
  });
}

/** Same Supabase project as the RenoVision client app. Always defined; throws on use when unconfigured. */
export const supabase: SupabaseClient = createConfiguredClient();

export const MEDIA_BUCKET = "project-media";
export const INTERNAL_BUCKET = "project-internal";

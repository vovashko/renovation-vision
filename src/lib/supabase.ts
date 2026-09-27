import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const README_HINT = "See README → Local Supabase.";

export const SUPABASE_CONFIG_ERROR =
  "Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see README → Local Supabase).";

/** The role claim of a legacy JWT key (anon / service_role), or undefined when the value isn't a JWT. */
function jwtRole(key: string): unknown {
  const payload = key.split(".")[1];
  if (key.split(".").length !== 3 || !payload) return undefined;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return (JSON.parse(json) as { role?: unknown }).role;
  } catch {
    return undefined;
  }
}

const SECRET_KEY =
  "VITE_SUPABASE_PUBLISHABLE_KEY holds a secret key. VITE_* values ship to every browser, so use the publishable key " +
  "(sb_publishable_…, or the legacy anon JWT) from `supabase status -o env` instead, and rotate the secret key if this build was ever deployed. " +
  README_HINT;

const envSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, `Supabase is not configured: VITE_SUPABASE_URL is empty. Set it to the API URL, e.g. http://127.0.0.1:54321. ${README_HINT}`)
    .refine(
      (value) => {
        try {
          const { protocol, hostname } = new URL(value);
          return (protocol === "http:" || protocol === "https:") && hostname !== "";
        } catch {
          return false;
        }
      },
      (value) => ({
        message:
          `Supabase is misconfigured: VITE_SUPABASE_URL must be an http(s) URL such as http://127.0.0.1:54321 or ` +
          `https://<project-ref>.supabase.co, but it is "${value}". ${README_HINT}`,
      }),
    ),
  key: z
    .string()
    .trim()
    .min(
      1,
      `Supabase is not configured: VITE_SUPABASE_PUBLISHABLE_KEY is empty. Set it to the publishable key (sb_publishable_…) from \`supabase status -o env\`. ${README_HINT}`,
    )
    .refine((value) => !value.startsWith("sb_secret_"), `Supabase is misconfigured: ${SECRET_KEY}`)
    .refine((value) => jwtRole(value) !== "service_role", `Supabase is misconfigured: ${SECRET_KEY}`),
});

export type SupabaseEnv = { url: string; key: string };

/**
 * Checks the two public Supabase variables. Returns them trimmed, or a message that names the
 * variable, says what's expected and points to the README. Both missing gives `SUPABASE_CONFIG_ERROR`.
 */
export function validateSupabaseEnv(env: { url?: string; key?: string }): { ok: true; env: SupabaseEnv } | { ok: false; message: string } {
  if (!env.url?.trim() && !env.key?.trim()) return { ok: false, message: SUPABASE_CONFIG_ERROR };
  const parsed = envSchema.safeParse({ url: env.url ?? "", key: env.key ?? "" });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  return { ok: true, env: parsed.data };
}

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
  const result = validateSupabaseEnv({
    url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
    key: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined,
  });
  if (!result.ok) return unconfiguredClient(result.message);
  return createClient(result.env.url, result.env.key, {
    auth: { persistSession: typeof window !== "undefined", autoRefreshToken: true, detectSessionInUrl: true },
  });
}

/** Same Supabase project as the RenoVision client app. Always defined; throws on use when unconfigured. */
export const supabase: SupabaseClient = createConfiguredClient();

export const MEDIA_BUCKET = "project-media";
export const INTERNAL_BUCKET = "project-internal";

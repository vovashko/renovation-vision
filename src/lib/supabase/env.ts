// Public Supabase config (the two `VITE_*` values). Safe to import anywhere, browser included: it
// only validates values that already ship to every browser. Server secrets live in `@/lib/env`.
import { z } from "zod";

const README_HINT = "See README → Local Supabase.";

export const SUPABASE_CONFIG_ERROR =
  "Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see README → Local Supabase).";

/** The role claim of a legacy JWT key (anon / service_role), or undefined when the value isn't a JWT. */
export function jwtRole(key: string): unknown {
  const parts = key.split(".");
  const payload = parts[1];
  if (parts.length !== 3 || !payload) return undefined;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return (JSON.parse(json) as { role?: unknown }).role;
  } catch {
    return undefined;
  }
}

/** True for a Supabase secret key: `sb_secret_…` or a legacy `service_role` JWT. */
export function isSupabaseSecretKey(value: string): boolean {
  return value.startsWith("sb_secret_") || jwtRole(value) === "service_role";
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
    .refine((value) => !isSupabaseSecretKey(value), `Supabase is misconfigured: ${SECRET_KEY}`),
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

/** The public pair as Vite inlines it (`VITE_SUPABASE_ANON_KEY` is the legacy name for the key). */
export function readPublicSupabaseEnv(): { url?: string; key?: string } {
  return {
    url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
    key: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined,
  };
}

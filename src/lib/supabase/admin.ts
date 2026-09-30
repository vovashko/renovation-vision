// The admin Supabase client: authenticated with the SECRET key, so it BYPASSES ROW LEVEL SECURITY.
// Anything it reads or writes is unrestricted, so:
// - import it only from src/server/** (eslint `no-restricted-imports` error + tests/unit/arch);
// - only after the caller has been authenticated and authorized by the middleware
//   (requireUser / requireProjectRole / …), and prefer the per-request user client
//   (`context.supabase`, RLS applies) whenever it can do the job;
// - never return its raw rows to the browser without picking the fields the caller may see.
//
// SERVER-ONLY (import protection fails the client build if the browser graph imports this).
import "@tanstack/react-start/server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/domain/db.types";
import { getPublicEnv, requireSupabaseSecretKey } from "@/lib/env";

export type AdminSupabase = SupabaseClient<Database>;

let cached: { client: AdminSupabase; url: string; key: string } | undefined;

/**
 * The admin client (cached per isolate). Throws an `EnvError` that says how to set
 * SUPABASE_SECRET_KEY when it's missing, so a misconfigured deploy fails loudly at first use.
 */
export function getAdminSupabase(): AdminSupabase {
  const { url } = getPublicEnv();
  const key = requireSupabaseSecretKey();
  if (!cached || cached.url !== url || cached.key !== key) {
    cached = {
      client: createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }),
      url,
      key,
    };
  }
  return cached.client;
}

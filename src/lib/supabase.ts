import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

/**
 * Same Supabase project as the RenoTrack client app. When the env vars are
 * missing the portal runs in demo mode against an in-memory copy of the seed.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: typeof window !== "undefined", autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

export const isDemo = supabase === null;

export const MEDIA_BUCKET = "project-media";
export const INTERNAL_BUCKET = "project-internal";

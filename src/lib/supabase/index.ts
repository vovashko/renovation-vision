// `@/lib/supabase` is the browser client, exactly as before the split, so the features/<f>/data
// repositories keep importing `{ supabase }` from here. The server clients are deliberately NOT
// re-exported: import `@/lib/supabase/server` (as the user) or `@/lib/supabase/admin` (bypasses
// RLS; src/server/** only) by path, so they can never leak into a browser import by accident.
export { supabase, migrateLegacySession, MEDIA_BUCKET, INTERNAL_BUCKET, DOCUMENTS_BUCKET } from "./browser";
export { SUPABASE_CONFIG_ERROR, validateSupabaseEnv, type SupabaseEnv } from "./env";

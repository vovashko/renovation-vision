// Mirrors the UI locale onto the signed-in user's Supabase Auth `user_metadata.locale`, so the
// hosted auth emails (supabase/templates/*.html, `{{ if eq .Data.locale "en" }}`) render in the
// right language — the cookie the rest of the app reads (@/i18n) isn't visible to Supabase Auth.
// Called from the language switch on /settings and, if missing, once after sign-in (see
// @/lib/auth's AuthSync). Client-side only: the browser Supabase client already holds the session.
import type { Locale } from "@/i18n/locale";
import { supabase } from "@/lib/supabase";

export async function updateUserLocale(locale: Locale): Promise<void> {
  const { error } = await supabase.auth.updateUser({ data: { locale } });
  if (error) throw error;
}

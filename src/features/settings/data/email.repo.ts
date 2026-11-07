// The signed-in user's login email and its secure change (T70), on Supabase Auth. Errors are gotrue's AuthErrors.
//
// The redirect is built from the page's own origin and must be on the Auth redirect allow-list (site_url /
// additional_redirect_urls locally, Authentication → URL Configuration on a hosted project).
import { supabase } from "@/lib/supabase";
import { EMAIL_CHANGE_PATH } from "../domain/email";

export type AccountEmail = {
  email: string | null;
  /** The address waiting for confirmation, while a change is pending. */
  newEmail: string | null;
};

export const emailRepo = {
  /** The account's email and any pending change, from the server (`getUser`, not the cached session). */
  async current(): Promise<AccountEmail> {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return { email: data.user?.email ?? null, newEmail: data.user?.new_email ?? null };
  },

  /**
   * Starts the change: with secure email change on, gotrue emails a confirmation link to the current and the new
   * address, and the email changes once both are opened. Asking again replaces a pending change.
   */
  async requestChange(email: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${window.location.origin}${EMAIL_CHANGE_PATH}` });
    if (error) throw error;
  },
};

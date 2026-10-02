// Password, magic-link and recovery calls on the browser Supabase client. Errors are rethrown as
// supabase-js AuthErrors (with gotrue's `code`), which ../domain/auth-errors maps to i18n keys.
//
// Redirect URLs are built from the page's own origin (never a configured fallback) and must be on
// Supabase Auth's allow-list: `site_url`/`additional_redirect_urls` in supabase/config.toml locally,
// Authentication → URL Configuration on a hosted project.
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { EmailLinkType } from "../domain/auth-link";

function origin(): string {
  return window.location.origin;
}

export const authRepo = {
  async signInWithPassword(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  /**
   * Emails a sign-in link (existing accounts only). It lands on /login (public), keeping `redirect`;
   * the browser client exchanges the PKCE code there and AuthSync sends the user on.
   */
  async sendMagicLink(email: string, redirect?: string): Promise<void> {
    const query = redirect && redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : "";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${origin()}/login${query}` },
    });
    if (error) throw error;
  },

  /** Emails a password-reset link that lands on /reset-password. gotrue answers the same whether or not the account exists. */
  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/reset-password` });
    if (error) throw error;
  },

  /** Verifies a `token_hash` link (`?token_hash=…&type=…`) and signs the user in. */
  async verifyEmailLink(tokenHash: string, type: EmailLinkType): Promise<void> {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) throw error;
  },

  /**
   * The browser session once the client has finished starting up, which includes exchanging a PKCE
   * `?code=` from an auth link (getSession waits for that).
   */
  async currentSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /**
   * Sets a new password. With `secure_password_change` on, a session older than 24 h needs the
   * emailed reauthentication code (`nonce`); gotrue then answers `reauthentication_needed`. An
   * account with 2FA needs an aal2 session (`insufficient_aal`).
   */
  async updatePassword(password: string, nonce?: string): Promise<void> {
    const { error } = await supabase.auth.updateUser(nonce ? { password, nonce } : { password });
    if (error) throw error;
  },

  /** Emails the signed-in user a reauthentication code (the `reauthentication` template). */
  async reauthenticate(): Promise<void> {
    const { error } = await supabase.auth.reauthenticate();
    if (error) throw error;
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },
};

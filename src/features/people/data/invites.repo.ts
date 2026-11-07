// Invites in the browser (T40): the project's open invitations (managers, RLS), and the invitee's side of
// /accept-invite: verify the link's token, save the password and profile, accept through the RPC. Sending, resending
// and withdrawing invites are server functions (src/server/functions/invites.ts), which the hooks call.
import { supabase } from "@/lib/supabase";
import type { Locale } from "@/i18n/locale";
import { PeopleRepoError } from "./people.repo";

export type PendingInvitation = { id: string; email: string; role: "client" | "manager"; expires_at: string; created_at: string };

export const invitesRepo = {
  /** The project's open (not accepted, not withdrawn) invitations, oldest first. Expired ones are included. */
  async listPending(projectId: string): Promise<PendingInvitation[]> {
    const { data, error } = await supabase
      .from("invitations")
      .select("id, email, role, expires_at, created_at")
      .eq("project_id", projectId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at");
    if (error) throw new PeopleRepoError(error.message, error.hint ?? undefined);
    return (data ?? []) as PendingInvitation[];
  },

  /** Signs the invitee in with the link's token (`verifyOtp`, type invite). Rethrows gotrue's AuthError. */
  async verifyLink(tokenHash: string): Promise<void> {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
    if (error) throw error;
  },

  /** The signed-in account's email, if any. */
  async sessionEmail(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.email?.toLowerCase() ?? null;
  },

  /** Sets the password (when given) and mirrors the name and language onto user_metadata for the auth emails. */
  async saveAccount(input: { password?: string; fullName: string; locale: Locale }): Promise<void> {
    const data = { full_name: input.fullName, locale: input.locale };
    const { error } = await supabase.auth.updateUser(input.password ? { password: input.password, data } : { data });
    if (error) throw error;
  },

  /** `accept_invitation`: name, language, consent, and a manager invite's staff account. Returns the project to open. */
  async accept(input: { tokenHash: string; fullName: string; locale: Locale; privacyVersion: string }): Promise<string | null> {
    const { data, error } = await supabase.rpc("accept_invitation", {
      p_token: input.tokenHash,
      p_full_name: input.fullName,
      p_locale: input.locale,
      p_privacy_version: input.privacyVersion,
    });
    if (error) throw new PeopleRepoError(error.message, error.hint ?? undefined);
    return (data as string | null) ?? null;
  },
};

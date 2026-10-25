// Pure rule for the client card's access status. No Supabase, no React.
import type { Member, ProjectContact } from "@/lib/database.types";

export type ClientAccessStatus = "access" | "invited" | "waiting" | "none";

/** An open invitation as the card needs it (`invitations` row, not accepted or withdrawn). */
export type OpenInvite = { email: string; role: string };

/**
 * The client card's access status: `"access"` once the client contact's linked account holds a
 * `client` membership on this project, `"waiting"` when there's an email but no (linked, granted)
 * account yet, and `"none"` when the project has no client email on file. The membership check
 * (not just `contact.user_id`) matches what `private.sync_client_access` actually grants.
 *
 * `"invited"` (T40) wins while a client invitation for that email is open: the invite already
 * created the account (so the membership exists), but nobody has accepted it and signed in yet.
 */
export function clientAccessStatus(
  client: ProjectContact | undefined,
  clientMembers: Member[],
  openInvites: OpenInvite[] = [],
): ClientAccessStatus {
  const email = client?.contact.email?.toLowerCase();
  if (!client || !email) return "none";
  if (openInvites.some((i) => i.role === "client" && i.email === email)) return "invited";
  const hasAccount = client.contact.user_id !== null && clientMembers.some((m) => m.user_id === client.contact.user_id);
  return hasAccount ? "access" : "waiting";
}

// Pure rule for the client card's access status. No Supabase, no React.
import type { Member, ProjectContact } from "@/lib/database.types";

export type ClientAccessStatus = "access" | "waiting" | "none";

/**
 * The client card's access status: `"access"` once the client contact's linked account holds a
 * `client` membership on this project, `"waiting"` when there's an email but no (linked, granted)
 * account yet, and `"none"` when the project has no client email on file. The membership check
 * (not just `contact.user_id`) matches what `private.sync_client_access` actually grants.
 */
export function clientAccessStatus(client: ProjectContact | undefined, clientMembers: Member[]): ClientAccessStatus {
  if (!client?.contact.email) return "none";
  const hasAccount = client.contact.user_id !== null && clientMembers.some((m) => m.user_id === client.contact.user_id);
  return hasAccount ? "access" : "waiting";
}

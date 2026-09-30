import { useAuth } from "@/lib/auth";
import type { ProjectRole } from "@/lib/database.types";

/**
 * The signed-in user's role for project navigation (the desktop rail and the phone bottom bar).
 * Per-project roles (a manager who is also invited as a client on another project, say) come in a
 * later task; for now this mirrors the account-level `profile.account_type` check both navs used
 * to run separately.
 */
export function useNavRole(): ProjectRole {
  const isManager = useAuth().profile?.account_type === "manager";
  return isManager ? "manager" : "client";
}

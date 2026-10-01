import { useParams } from "@tanstack/react-router";
import { useProjectRole } from "@/features/auth/hooks";
import { useAuth } from "@/lib/auth";
import type { ProjectRole } from "@/lib/database.types";

/**
 * The role a nav decision is made for:
 * - inside a project, the user's per-project role (`project_members.role`, the same thing RLS and the
 *   project layout's guard use), so a manager account invited as a client on someone else's project
 *   gets the client nav there; while it loads (it's normally already cached by the layout guard),
 *   the least-privileged "client";
 * - outside one (`/projects`, `/settings`), the account-level `profiles.account_type`.
 */
export function navRoleFor(projectRole: ProjectRole | null, inProject: boolean, accountType: string | null | undefined): ProjectRole {
  if (inProject) return projectRole ?? "client";
  return accountType === "manager" ? "manager" : "client";
}

/** The signed-in user's role for navigation (the desktop rail, the phone bar, quick actions, role-aware pages). */
export function useNavRole(): ProjectRole {
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const projectRole = useProjectRole(projectId);
  const { profile } = useAuth();
  return navRoleFor(projectRole, !!projectId, profile?.account_type);
}

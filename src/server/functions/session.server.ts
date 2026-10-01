// The handler bodies behind ./session.ts, kept in a `.server.ts` module so they never reach the
// browser bundle.
import type { ProjectSummary } from "@/lib/database.types";
import { authenticateRequest } from "../auth.server";
import { ServerFnError } from "../errors";
import type { AccountType, Aal, AuthContext } from "../middleware/auth";

export type SessionUser = { id: string; email: string | null; aal: Aal };
export type SessionProfile = { full_name: string; avatar_url: string | null; account_type: AccountType; locale?: string | null };
/** What the server sees for the current request: the verified user and their profile, or nulls when signed out. */
export type Session = { user: SessionUser | null; profile: SessionProfile | null };
export type ProjectRole = "manager" | "client";
/** The caller's per-project role (`project_members.role`) and the project summary, or nulls for a non-member. */
export type ProjectAccess = { role: ProjectRole | null; project: ProjectSummary | null };

export const SIGNED_OUT: Session = { user: null, profile: null };

/**
 * getSession's body: the request's cookie session, verified with `getClaims` exactly like requireUser
 * (via authenticateRequest), but a missing, invalid or expired session is `SIGNED_OUT`, not a 401.
 * Cookie only: an Authorization header is ignored, so this is what a hard page load would see.
 */
export async function loadSession(): Promise<Session> {
  let context: AuthContext;
  try {
    context = await authenticateRequest(null);
  } catch (error) {
    if (error instanceof ServerFnError && error.code === "UNAUTHORIZED") return SIGNED_OUT;
    throw error; // UNAVAILABLE etc.: the root error boundary shows it
  }
  const { user, supabase } = context;
  const { data, error } = await supabase.from("profiles").select("full_name, avatar_url, account_type").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return { user: { id: user.id, email: user.email, aal: user.aal }, profile: data ?? null };
}

/**
 * getProjectAccess's body: the caller's role on the project, read from `project_members` as the user
 * (RLS), never from the account-level `profiles.account_type`; plus the project summary for members,
 * so the project layout can server-render the real page.
 */
export async function loadProjectAccess(context: AuthContext, projectId: string): Promise<ProjectAccess> {
  const { user, supabase } = context;
  const [member, summary] = await Promise.all([
    supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
    supabase.from("project_summary").select("*").eq("id", projectId).maybeSingle(),
  ]);
  if (member.error) throw member.error;
  if (summary.error) throw summary.error;
  const role = member.data?.role ?? null;
  if (!role || !summary.data) return { role: null, project: null };
  const row = summary.data as unknown as ProjectSummary;
  // numeric columns can arrive as strings; match projectsRepo.getProject's shape
  return { role, project: { ...row, budget: Number(row.budget), spent: Number(row.spent) } };
}

// The route guards' decisions as pure functions (T21). The routes' beforeLoad hooks call these and
// turn the outcome into a TanStack `redirect`/`notFound`; tests cover them without a router.
import type { ProjectRole } from "@/lib/database.types";
import { managerOnlySections } from "@/shared/ui/nav-config";

/**
 * Where /login sends a signed-in user: the `redirect` search param if it is a same-origin path,
 * otherwise `/`. Rejects absolute and protocol-relative URLs (`https://evil`, `//evil`, `/\evil`),
 * so the param can't be used as an open redirect.
 */
export function safeRedirectTarget(redirect: unknown): string {
  if (typeof redirect !== "string") return "/";
  if (!redirect.startsWith("/") || redirect.startsWith("//") || redirect.startsWith("/\\")) return "/";
  if (redirect === "/login" || redirect.startsWith("/login?") || redirect.startsWith("/login/")) return "/";
  return redirect;
}

/** The project section a path points at: `/projects/<id>/budget` → "budget", the overview → "". */
export function projectSection(pathname: string): string {
  return pathname.split("/")[3] ?? "";
}

export type ProjectGuardOutcome = "not-found" | "overview" | "allow";

/**
 * The project layout's decision for a user's per-project `role` (`project_members.role`, null when
 * they aren't a member) and the section they asked for:
 * - not a member → "not-found" (the "Project not available" page);
 * - a client on a manager-only section (nav-config `managerOnlySections`) → "overview" (redirect);
 * - otherwise "allow".
 */
export function projectGuard(role: ProjectRole | null, section: string): ProjectGuardOutcome {
  if (!role) return "not-found";
  if (role !== "manager" && section && managerOnlySections.includes(section)) return "overview";
  return "allow";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A project id worth asking the server about (anything else can't be a project: not found). */
export const isProjectId = (value: string) => UUID.test(value);

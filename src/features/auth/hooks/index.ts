import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import type { ProjectRole } from "@/lib/database.types";
import { getProjectAccess, type ProjectAccess } from "@/server/functions/session";
import { keys } from "@/shared/query-keys";
import { isProjectId } from "../domain/guards";

/** Mirrors the UI locale onto `user_metadata.locale` (see ../data/locale.repo for why). */
export { updateUserLocale } from "../data/locale.repo";

const NO_ACCESS: ProjectAccess = { role: null, project: null };

/** Query keys for the session-derived data this feature caches. */
export const authKeys = {
  projectAccess: (projectId: string, userId: string) => ["projectAccess", projectId, userId] as const,
};

/**
 * The signed-in user's access to a project: their `project_members.role` (null = not a member) and
 * the project summary, from the `getProjectAccess` server function. Cached for 5 minutes: it decides
 * navigation, not data access (RLS does that), and sign-in/out clears the whole cache anyway.
 */
export const projectAccessQuery = (projectId: string, userId: string) =>
  queryOptions({
    queryKey: authKeys.projectAccess(projectId, userId),
    queryFn: (): Promise<ProjectAccess> =>
      isProjectId(projectId) ? getProjectAccess({ data: { projectId } }) : Promise.resolve(NO_ACCESS),
    staleTime: 5 * 60_000,
  });

/**
 * For the project layout's beforeLoad: the cached (or freshly loaded) access, and the project
 * summary seeded into `keys.project(id)` when nothing fresher is cached, so the page (and its SSR
 * HTML) renders the real project instead of a loading state.
 */
export async function ensureProjectAccess(queryClient: QueryClient, projectId: string, userId: string): Promise<ProjectAccess> {
  const access = await queryClient.ensureQueryData(projectAccessQuery(projectId, userId));
  if (access.project && queryClient.getQueryData(keys.project(projectId)) === undefined) {
    queryClient.setQueryData(keys.project(projectId), access.project);
  }
  return access;
}

/** The signed-in user's role on a project (`project_members.role`), or null while loading / not a member. */
export function useProjectRole(projectId: string | undefined): ProjectRole | null {
  const { userId } = useAuth();
  const { data } = useQuery({
    ...projectAccessQuery(projectId ?? "", userId ?? ""),
    enabled: !!projectId && !!userId,
  });
  return data?.role ?? null;
}

/** The role inside the current route's project (`$projectId`), or null outside one. */
export function useCurrentProjectRole(): ProjectRole | null {
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  return useProjectRole(projectId);
}

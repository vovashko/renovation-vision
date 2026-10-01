import { createFileRoute, Link, notFound, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ensureProjectAccess } from "@/features/auth/hooks";
import { projectGuard, projectSection } from "@/features/auth/domain/guards";
import { ProjectEmpty } from "@/shared/ui/project-empty";

/**
 * Project guard (README → Sessions & route guards), on the server for a hard load and in the
 * browser on navigation. The user's per-project role comes from `project_members` (getProjectAccess,
 * cached in the query client):
 * - not a member → "Project not available" (notFound, thrown from the loader so this route's
 *   notFoundComponent renders it inside the app shell);
 * - a client on a manager-only section → the project overview;
 * - otherwise the page. RLS remains the real enforcement; this decides what to render.
 */
export const Route = createFileRoute("/_authed/projects/$projectId")({
  beforeLoad: async ({ context, params, location }) => {
    const access = await ensureProjectAccess(context.queryClient, params.projectId, context.user.id);
    if (projectGuard(access.role, projectSection(location.pathname)) === "overview") {
      throw redirect({ to: "/projects/$projectId", params, replace: true });
    }
    return { projectRole: access.role };
  },
  loader: ({ context }) => {
    if (projectGuard(context.projectRole, "") === "not-found") throw notFound();
  },
  notFoundComponent: ProjectNotAvailable,
  component: Outlet,
});

function ProjectNotAvailable() {
  const { t } = useTranslation(["projects", "common"]);
  return (
    <ProjectEmpty
      title={t("layout.notAvailableTitle")}
      text={t("layout.notAvailableText")}
      action={
        <Link to="/" className="text-label-lg text-primary hover:underline">
          {t("common:actions.back")}
        </Link>
      }
    />
  );
}

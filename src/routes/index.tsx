import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageLoading } from "@/components/page-header";
import { projectsQuery, useProjects } from "@/features/projects/hooks";
import { ProjectEmpty } from "@/shared/ui/project-empty";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authed/")({
  // Decided before rendering (on the server for a hard load), so "/" never flashes a loading state.
  beforeLoad: async ({ context }) => {
    if (context.auth.profile?.account_type === "manager") throw redirect({ to: "/projects", replace: true });
    const projects = await context.queryClient.ensureQueryData(projectsQuery());
    if (projects.length) throw redirect({ to: "/projects/$projectId", params: { projectId: projects[0].id }, replace: true });
  },
  component: Home,
});

/** Managers land on their project list; a client goes straight to their project. */
function Home() {
  const { t } = useTranslation(["projects"]);
  const { profile } = useAuth();
  const isManager = profile?.account_type === "manager";
  const { data: projects, isLoading } = useProjects();

  if (isManager) return <Navigate to="/projects" replace />;
  if (isLoading || !projects) return <PageLoading />;
  if (!projects.length) {
    return <ProjectEmpty title={t("home.emptyTitle")} text={t("home.emptyDescription")} />;
  }
  return <Navigate to="/projects/$projectId" params={{ projectId: projects[0].id }} replace />;
}

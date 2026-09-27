import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageLoading } from "@/components/page-header";
import { useProject } from "@/features/projects/hooks";
import { ProjectEmpty } from "@/shared/ui/project-empty";
import { managerOnlySections } from "@/shared/ui/nav-config";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectLayout,
});

function ProjectLayout() {
  const { t } = useTranslation(["projects", "common"]);
  const { projectId } = Route.useParams();
  const { profile } = useAuth();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { isLoading, error } = useProject(projectId);
  const isManager = profile?.account_type === "manager";

  // UI guard only: RLS is what actually keeps clients out of manager data.
  const section = path.split("/")[3];
  if (!isManager && section && managerOnlySections.includes(section)) {
    return <Navigate to="/projects/$projectId" params={{ projectId }} replace />;
  }
  if (isLoading) return <PageLoading />;
  if (error) {
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
  return <Outlet />;
}

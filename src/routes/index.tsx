import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageLoading } from "@/components/page-header";
import { useProjects } from "@/features/projects/hooks";
import { ProjectEmpty } from "@/shared/ui/project-empty";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
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

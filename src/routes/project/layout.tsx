import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { FolderX } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageLoading } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { managerOnlySections } from "@/lib/nav";
import { useProject } from "@/lib/queries";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectLayout,
});

function ProjectLayout() {
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
      <EmptyState
        className="mx-auto mt-10 max-w-md"
        icon={FolderX}
        title="Project not available"
        text="It doesn't exist, or you're not a member of it."
        action={
          <Link to="/" className="text-sm text-primary hover:underline">
            Back
          </Link>
        }
      />
    );
  }
  return <Outlet />;
}

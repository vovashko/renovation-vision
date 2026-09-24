import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { FolderX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/page-header";
import { useProject } from "@/lib/queries";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const { isLoading, error } = useProject(projectId);
  if (isLoading) return <PageLoading />;
  if (error) {
    return (
      <EmptyState
        className="mx-auto mt-10 max-w-md"
        icon={FolderX}
        title="Project not available"
        text="It doesn't exist, or you're not assigned to it as a manager."
        action={<Link to="/" className="text-sm text-primary hover:underline">Back to all projects</Link>}
      />
    );
  }
  return <Outlet />;
}

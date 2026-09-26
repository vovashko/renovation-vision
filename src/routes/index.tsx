import { createFileRoute, Navigate } from "@tanstack/react-router";
import { EmptyState } from "@/components/empty-state";
import { PageLoading } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { useProjects } from "@/lib/queries";

export const Route = createFileRoute("/")({
  component: Home,
});

/** Managers land on their project list; a client goes straight to their project. */
function Home() {
  const { profile } = useAuth();
  const isManager = profile?.account_type === "manager";
  const { data: projects, isLoading } = useProjects();

  if (isManager) return <Navigate to="/projects" replace />;
  if (isLoading || !projects) return <PageLoading />;
  if (!projects.length) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <EmptyState
          className="mx-auto mt-10 max-w-md"
          icon="folder_off"
          title="No project yet"
          text="Your site manager hasn't added you to a project. Ask them to invite you by email."
        />
      </div>
    );
  }
  return <Navigate to="/projects/$projectId" params={{ projectId: projects[0].id }} replace />;
}

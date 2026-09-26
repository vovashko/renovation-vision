import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { FormSheet } from "@/components/manager/form-sheet";
import { PageHeader, PageLoading } from "@/components/page-header";
import { NewProjectForm, type NewProjectFormState } from "@/features/projects/ui/new-project-form";
import { ProjectListItem } from "@/features/projects/ui/project-list-item";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useProjects } from "@/lib/queries";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [{ title: "Projects — RenoVision" }, { name: "description", content: "All renovation projects you manage." }],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { profile } = useAuth();
  const { data: projects, isLoading } = useProjects();
  const [open, setOpen] = useState(false);
  if (profile?.account_type !== "manager") return <Navigate to="/" replace />;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Your projects"
        description="Everything you update here appears in the client's RenoVision view."
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Icon name="add" size={20} /> New project
          </Button>
        }
      />
      {isLoading ? (
        <PageLoading />
      ) : !projects?.length ? (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon" icon="create_new_folder" />
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>Create a project, then invite your client from the Team page.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="mt-6 md:grid md:grid-cols-2 md:gap-4">
          {projects.map((p) => (
            <ProjectListItem key={p.id} project={p} />
          ))}
        </ItemGroup>
      )}
      <NewProjectSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NewProjectSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<NewProjectFormState>({
    name: "",
    address: "",
    client_name: "",
    start_date: "",
    target_date: "",
    budget: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const id = await api.createProject({
        name: form.name.trim(),
        address: form.address.trim(),
        client_name: form.client_name.trim(),
        start_date: form.start_date || null,
        target_date: form.target_date || null,
        budget: Number(form.budget) || 0,
      });
      await qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
      onOpenChange(false);
      navigate({ to: "/projects/$projectId", params: { projectId: id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New project"
      description="You become its manager. Add stages, rooms and your client next."
    >
      <NewProjectForm form={form} onChange={setForm} onSubmit={submit} saving={saving} />
    </FormSheet>
  );
}

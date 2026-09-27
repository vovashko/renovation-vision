import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { FormSheet } from "@/shared/ui/form-sheet";
import { PageHeader, PageLoading } from "@/components/page-header";
import { NewProjectForm } from "@/features/projects/ui/new-project-form";
import { ProjectListItem } from "@/features/projects/ui/project-list-item";
import { useCreateProject, useProjects } from "@/features/projects/hooks";
import type { NewProjectValues } from "@/features/projects/domain/schemas";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [{ title: "Projects — RenoVision" }, { name: "description", content: "All renovation projects you manage." }],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { t } = useTranslation(["projects"]);
  const { profile } = useAuth();
  const { data: projects, isLoading } = useProjects();
  const [open, setOpen] = useState(false);
  if (profile?.account_type !== "manager") return <Navigate to="/" replace />;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title={t("list.title")}
        description={t("list.description")}
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Icon name="add" size={20} /> {t("list.newProject")}
          </Button>
        }
      />
      {isLoading ? (
        <PageLoading />
      ) : !projects?.length ? (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon" icon="create_new_folder" />
            <EmptyTitle>{t("list.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("list.emptyDescription")}</EmptyDescription>
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
  const { t } = useTranslation(["projects"]);
  const navigate = useNavigate();
  const create = useCreateProject();

  const submit = (values: NewProjectValues) => {
    create.mutate(
      { ...values, start_date: values.start_date || null, target_date: values.target_date || null },
      {
        onSuccess: (id) => {
          onOpenChange(false);
          navigate({ to: "/projects/$projectId", params: { projectId: id } });
        },
      },
    );
  };

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={t("newProject.title")} description={t("newProject.description")}>
      <NewProjectForm onSubmit={submit} saving={create.isPending} />
    </FormSheet>
  );
}

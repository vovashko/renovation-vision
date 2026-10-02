import { queryOptions, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { projectsRepo, type NewProject, type ProjectPatch } from "../data/projects.repo";
import type { ProjectStatus } from "../domain/project-fields";

/** `projectStatusLabel("on_hold")` → "Wstrzymany" / "On hold" (`projects:projectStatus.*`). */
export function useProjectStatusLabel(): (status: ProjectStatus) => string {
  const { t } = useTranslation(["projects"]);
  return (status) => t(`projectStatus.${status}`);
}

/** The signed-in user's projects; shared by useProjects and the home route's beforeLoad (T21). */
export const projectsQuery = () => queryOptions({ queryKey: keys.projects, queryFn: projectsRepo.listProjects });

export const useProjects = () => useQuery(projectsQuery());

export const useProject = (id: string | undefined) =>
  useQuery({ queryKey: keys.project(id ?? ""), queryFn: () => projectsRepo.getProject(id!), enabled: !!id });

export function useCreateProject() {
  const { t } = useTranslation(["projects"]);
  return useMutationWithToast((input: NewProject) => projectsRepo.createProject(input), {
    invalidate: [keys.projects],
    success: t("list.created"),
  });
}

export function useUpdateProject(projectId: string) {
  const { t } = useTranslation(["projects"]);
  return useMutationWithToast((patch: ProjectPatch) => projectsRepo.updateProject(projectId, patch), {
    invalidate: [keys.project(projectId), keys.projects],
    success: t("details.saved"),
  });
}

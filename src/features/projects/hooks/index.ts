import { queryOptions, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { projectsRepo, type ClientContact, type NewProject, type ProjectPatch } from "../data/projects.repo";

/** The signed-in user's projects; shared by useProjects and the home route's beforeLoad (T21). */
export const projectsQuery = () => queryOptions({ queryKey: keys.projects, queryFn: projectsRepo.listProjects });

export const useProjects = () => useQuery(projectsQuery());

export const useProject = (id: string | undefined) =>
  useQuery({ queryKey: keys.project(id ?? ""), queryFn: () => projectsRepo.getProject(id!), enabled: !!id });

/** `project_internal.client_phone`/`client_email`, shared with the budget feature's internal notes on the same row. */
export const useClientContact = (id: string) => useQuery({ queryKey: keys.internal(id), queryFn: () => projectsRepo.getClientContact(id) });

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

export function useUpdateClientContact(projectId: string) {
  const { t } = useTranslation(["projects"]);
  return useMutationWithToast((contact: ClientContact) => projectsRepo.updateClientContact(projectId, contact), {
    invalidate: [keys.internal(projectId)],
    success: t("client.contactSaved"),
  });
}

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { keys } from "@/lib/queries";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import type { CrewMember, Member, ProjectRole } from "@/lib/database.types";
import { peopleRepo, type CrewInput } from "../data/people.repo";

export const useMembers = (projectId: string) =>
  useQuery({ queryKey: keys.members(projectId), queryFn: () => peopleRepo.listMembers(projectId) });

export const useCrew = (projectId: string) => useQuery({ queryKey: keys.crew(projectId), queryFn: () => peopleRepo.listCrew(projectId) });

export function useAddMember(projectId: string) {
  const { t } = useTranslation(["people"]);
  return useMutationWithToast((vars: { email: string; role: ProjectRole }) => peopleRepo.addMember(projectId, vars.email, vars.role), {
    invalidate: [keys.members(projectId)],
    success: (vars) => t("team.added", { email: vars.email }),
  });
}

export function useRemoveMember(projectId: string) {
  const { t } = useTranslation(["people"]);
  return useMutationWithToast((member: Member) => peopleRepo.removeMember(projectId, member.user_id), {
    invalidate: [keys.members(projectId)],
    success: (member) => t("team.removed", { name: member.profile.full_name }),
  });
}

export function useSaveCrew(projectId: string) {
  const { t } = useTranslation(["people"]);
  return useMutationWithToast((input: CrewInput) => peopleRepo.saveCrew(projectId, input), {
    invalidate: [keys.crew(projectId)],
    success: (input) => t("crew.saved", { name: input.name }),
  });
}

export function useDeleteCrew(projectId: string) {
  const { t } = useTranslation(["people"]);
  return useMutationWithToast((crew: CrewMember) => peopleRepo.deleteCrew(crew.id), {
    invalidate: [keys.crew(projectId)],
    success: (crew) => t("crew.removed", { name: crew.name }),
  });
}

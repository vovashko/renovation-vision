import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { keys } from "@/lib/queries";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { budgetRepo } from "../data/budget.repo";

export const useInternalNotes = (projectId: string) =>
  useQuery({ queryKey: keys.internal(projectId), queryFn: () => budgetRepo.getInternal(projectId) });

export function useUpdateInternalNotes(projectId: string) {
  const { t } = useTranslation(["budget"]);
  return useMutationWithToast((notes: string) => budgetRepo.updateInternal(projectId, notes), {
    invalidate: [keys.internal(projectId)],
    success: t("budget:internalNotes.saved"),
  });
}

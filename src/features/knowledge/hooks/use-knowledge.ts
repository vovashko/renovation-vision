import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { keys } from "@/lib/queries";
import { knowledgeRepo, type KnowledgeInput } from "@/features/knowledge/data/knowledge.repo";
import type { Knowledge } from "@/lib/database.types";

/** AI knowledge entries for a project, ordered by creation. */
export const useKnowledge = (projectId: string) =>
  useQuery({ queryKey: keys.knowledge(projectId), queryFn: () => knowledgeRepo.list(projectId) });

/** Create or update a knowledge entry (an `id` in `input` updates that entry). */
export function useSaveKnowledge(projectId: string) {
  const { t } = useTranslation(["knowledge"]);
  return useMutationWithToast((input: KnowledgeInput) => knowledgeRepo.save(projectId, input), {
    invalidate: [keys.knowledge(projectId), keys.activity(projectId)],
    success: t("knowledge:toast.saved"),
  });
}

/** Delete a knowledge entry by id. */
export function useDeleteKnowledge(projectId: string) {
  const { t } = useTranslation(["knowledge"]);
  return useMutationWithToast((knowledgeId: string) => knowledgeRepo.remove(knowledgeId), {
    invalidate: [keys.knowledge(projectId), keys.activity(projectId)],
    success: t("knowledge:toast.deleted"),
  });
}

/** Flip an entry's "visible to the assistant" flag. */
export function useToggleKnowledgeVisible(projectId: string) {
  const { t } = useTranslation(["knowledge"]);
  return useMutationWithToast((entry: Knowledge) => knowledgeRepo.save(projectId, { id: entry.id, is_visible: !entry.is_visible }), {
    invalidate: [keys.knowledge(projectId), keys.activity(projectId)],
    // `entry` is the value before the toggle: was visible → now hidden, and vice versa.
    success: (entry) => (entry.is_visible ? t("knowledge:toast.hidden") : t("knowledge:toast.shown")),
  });
}

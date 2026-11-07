import { queryOptions, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { diaryRepo, type DiaryEntryInput } from "../data/diary.repo";

// The site diary's queries and mutations (T43). Every key starts with `keys.diary(projectId)`, so one
// invalidation refreshes the entries and the materials linked to them.

export const diaryQuery = (projectId: string) =>
  queryOptions({ queryKey: keys.diary(projectId), queryFn: () => diaryRepo.listEntries(projectId) });

/** The diary as the signed-in user may read it: managers get every entry, clients the visible ones (RLS). */
export const useDiaryEntries = (projectId: string) => useQuery(diaryQuery(projectId));

/** The project's materials; only managers can read them, so pass `enabled: false` for a client. */
export const useDiaryMaterials = (projectId: string, enabled = true) =>
  useQuery({ queryKey: [...keys.diary(projectId), "materials"], queryFn: () => diaryRepo.listMaterials(projectId), enabled });

// An entry's insert/update/delete is logged and may notify, and its materials are shown elsewhere too.
const invalidation = (projectId: string) => [
  keys.diary(projectId),
  keys.photos(projectId),
  keys.activity(projectId),
  keys.notifications(projectId),
];

export type SaveDiaryEntryVars = { entry: DiaryEntryInput; materialIds: string[]; previousMaterialIds: string[] };

/** Saves the entry, then links its materials; resolves to the entry id so the caller can attach photos. */
export function useSaveDiaryEntry(projectId: string) {
  const { t } = useTranslation(["work"]);
  return useMutationWithToast(
    async ({ entry, materialIds, previousMaterialIds }: SaveDiaryEntryVars) => {
      const id = await diaryRepo.saveEntry(projectId, entry);
      await diaryRepo.setEntryMaterials(id, materialIds, previousMaterialIds);
      return id;
    },
    { invalidate: invalidation(projectId), success: t("work:diary.saved") },
  );
}

export function useDeleteDiaryEntry(projectId: string) {
  const { t } = useTranslation(["work"]);
  return useMutationWithToast((entryId: string) => diaryRepo.deleteEntry(entryId), {
    invalidate: invalidation(projectId),
    success: t("work:diary.removed"),
  });
}

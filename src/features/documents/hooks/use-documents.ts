import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { documentsRepo, type NewDocument } from "@/features/documents/data/documents.repo";
import { normalizeImage } from "@/features/media/domain/normalize-image";
import { isHeicFile } from "@/features/media/domain/upload";
import { deleteDocument } from "@/server/functions/documents";
import type { ProjectDocument } from "@/lib/database.types";

/** All documents of a project the caller can see. */
export function useDocuments(projectId: string) {
  return useQuery({
    queryKey: keys.documents(projectId),
    queryFn: () => documentsRepo.listDocuments(projectId),
    staleTime: 30 * 60 * 1000,
  });
}

/** HEIC becomes JPEG before upload; every other file goes up as picked. */
async function prepare(input: NewDocument): Promise<NewDocument> {
  if (isHeicFile(input.file)) {
    const { file } = await normalizeImage(input.file);
    return { ...input, file };
  }
  return input;
}

export function useUploadDocument(projectId: string) {
  const { t } = useTranslation(["documents"]);
  return useMutationWithToast(async (input: NewDocument) => documentsRepo.uploadDocument(projectId, await prepare(input)), {
    invalidate: [keys.documents(projectId)],
    success: t("toast.uploaded"),
  });
}

export function useUpdateDocument(projectId: string) {
  const { t } = useTranslation(["documents"]);
  return useMutationWithToast((vars: { id: string; description: string }) => documentsRepo.updateDescription(vars.id, vars.description), {
    invalidate: [keys.documents(projectId)],
    success: t("toast.updated"),
  });
}

/** Deletes the row and then the storage object (one server call). There is no archive and no undo. */
export function useDeleteDocument(projectId: string) {
  const { t } = useTranslation(["documents"]);
  return useMutationWithToast((doc: ProjectDocument) => deleteDocument({ data: { projectId, documentId: doc.id } }), {
    invalidate: [keys.documents(projectId)],
    success: t("toast.deleted"),
  });
}

/** Signs a one-minute URL and opens it (the browser downloads the file under its safe name). */
export function useDownloadDocument() {
  const { t } = useTranslation(["documents"]);
  return useMutation({
    mutationFn: async (doc: Pick<ProjectDocument, "storage_path" | "file_name">) => {
      const url = await documentsRepo.downloadUrl(doc);
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    onError: (e: Error) => toast.error(e.message || t("toast.downloadFailed")),
  });
}

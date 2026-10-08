import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { documentsRepo, type DocumentPatch, type NewDocument } from "@/features/documents/data/documents.repo";
import { reencodeImage } from "@/features/media/domain/strip-exif";
import { shouldReencode } from "@/features/media/domain/upload";
import type { ProjectDocument } from "@/lib/database.types";

/** All documents of a project the caller can see, with thumbnail URLs for installation photos. */
export function useDocuments(projectId: string) {
  return useQuery({
    queryKey: keys.documents(projectId),
    queryFn: () => documentsRepo.listDocuments(projectId),
    staleTime: 30 * 60 * 1000,
  });
}

/** Installation photos lose their EXIF/GPS data like site photos do (jpeg/png/webp are re-encoded; HEIC can't be). */
async function prepare(input: NewDocument): Promise<NewDocument> {
  if (input.category === "installation_photos" && shouldReencode(input.file.type)) {
    const { file } = await reencodeImage(input.file);
    return { ...input, file };
  }
  return input;
}

export function useUploadDocument(projectId: string) {
  const { t } = useTranslation(["documents"]);
  return useMutationWithToast(async (input: NewDocument) => documentsRepo.uploadDocument(projectId, await prepare(input)), {
    invalidate: [keys.documents(projectId)],
    success: (input) => (input.versionOf ? t("toast.versionUploaded") : t("toast.uploaded")),
  });
}

export function useUpdateDocument(projectId: string) {
  const { t } = useTranslation(["documents"]);
  return useMutationWithToast((vars: { id: string; patch: DocumentPatch }) => documentsRepo.updateDocument(vars.id, vars.patch), {
    invalidate: [keys.documents(projectId)],
    success: t("toast.updated"),
  });
}

/** Archive (or restore) a document. A hard delete is not offered anywhere. */
export function useArchiveDocument(projectId: string) {
  const { t } = useTranslation(["documents"]);
  return useMutationWithToast((vars: { id: string; archived: boolean }) => documentsRepo.setArchived(vars.id, vars.archived), {
    invalidate: [keys.documents(projectId)],
    success: (vars) => (vars.archived ? t("toast.archived") : t("toast.restored")),
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

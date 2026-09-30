import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { mediaRepo, type PhotoMeta, type PhotoPatch } from "@/features/media/data/media.repo";
import type { Photo } from "@/lib/database.types";

/** Photos for a project, with signed URLs. Cached for 30 minutes: the signed URL is itself long-lived. */
export function usePhotos(projectId: string) {
  return useQuery({ queryKey: keys.photos(projectId), queryFn: () => mediaRepo.listPhotos(projectId), staleTime: 30 * 60 * 1000 });
}

/** A photo/render mutation invalidates both lists (a render can compare against a photo) plus the
 * activity feed and notifications a database trigger writes on insert/publish. */
function mediaInvalidate(projectId: string) {
  return [keys.photos(projectId), keys.renders(projectId), keys.activity(projectId), keys.notifications(projectId)];
}

export function useUploadPhotos(projectId: string) {
  const { t } = useTranslation(["media"]);
  return useMutationWithToast(
    (vars: { files: File[]; meta: PhotoMeta; publish: boolean }) => mediaRepo.uploadPhotos(projectId, vars.files, vars.meta, vars.publish),
    {
      invalidate: mediaInvalidate(projectId),
      success: (vars) =>
        vars.publish ? t("upload.publishedToast", { count: vars.files.length }) : t("upload.savedToast", { count: vars.files.length }),
    },
  );
}

export function useUpdatePhoto(projectId: string) {
  const { t } = useTranslation(["media"]);
  return useMutationWithToast((vars: { id: string; patch: PhotoPatch }) => mediaRepo.updatePhoto(vars.id, vars.patch), {
    invalidate: mediaInvalidate(projectId),
    success: (vars) =>
      vars.patch.status === "published"
        ? t("toast.published")
        : vars.patch.status === "draft"
          ? t("toast.unpublished")
          : t("toast.photoUpdated"),
  });
}

export function useDeletePhoto(projectId: string) {
  const { t } = useTranslation(["media"]);
  return useMutationWithToast((photo: Photo) => mediaRepo.deletePhoto(photo), {
    invalidate: mediaInvalidate(projectId),
    success: t("toast.photoDeleted"),
  });
}

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { mediaRepo, type RenderInput } from "@/features/media/data/media.repo";
import { reencodeImage } from "@/features/media/domain/strip-exif";
import { shouldReencode } from "@/features/media/domain/upload";
import { deleteRender } from "@/server/functions/media";
import type { Render } from "@/lib/database.types";

/** Strips EXIF/GPS and caps dimensions before upload (renders only ever accept jpeg/png/webp — see domain/upload.ts). */
async function prepareRenderInput(input: RenderInput): Promise<RenderInput> {
  if (!input.file || !shouldReencode(input.file.type)) return input;
  const { file } = await reencodeImage(input.file);
  return { ...input, file };
}

/** Design renders for a project, with signed URLs. */
export function useRenders(projectId: string) {
  return useQuery({ queryKey: keys.renders(projectId), queryFn: () => mediaRepo.listRenders(projectId), staleTime: 30 * 60 * 1000 });
}

function renderInvalidate(projectId: string) {
  return [keys.renders(projectId), keys.activity(projectId), keys.notifications(projectId)];
}

export function useSaveRender(projectId: string) {
  const { t } = useTranslation(["media"]);
  return useMutationWithToast(async (input: RenderInput) => mediaRepo.saveRender(projectId, await prepareRenderInput(input)), {
    invalidate: renderInvalidate(projectId),
    success: t("render.savedToast"),
  });
}

/** Deletes the row and the storage object atomically (server function; RLS as the user). */
export function useDeleteRender(projectId: string) {
  const { t } = useTranslation(["media"]);
  return useMutationWithToast((render: Render) => deleteRender({ data: { projectId, renderId: render.id } }), {
    invalidate: renderInvalidate(projectId),
    success: t("render.deletedToast"),
  });
}

/** Toggles whether a render is shared with the client. */
export function useToggleRenderVisible(projectId: string) {
  const { t } = useTranslation(["media"]);
  return useMutationWithToast((render: Render) => mediaRepo.saveRender(projectId, { id: render.id, is_visible: !render.is_visible }), {
    invalidate: renderInvalidate(projectId),
    success: (render) => (render.is_visible ? t("render.hiddenToast") : t("render.sharedToast")),
  });
}

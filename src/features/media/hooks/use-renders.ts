import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { keys } from "@/lib/queries";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { mediaRepo, type RenderInput } from "@/features/media/data/media.repo";
import type { Render } from "@/lib/database.types";

/** Design renders for a project, with signed URLs. */
export function useRenders(projectId: string) {
  return useQuery({ queryKey: keys.renders(projectId), queryFn: () => mediaRepo.listRenders(projectId), staleTime: 30 * 60 * 1000 });
}

function renderInvalidate(projectId: string) {
  return [keys.renders(projectId), keys.activity(projectId), keys.notifications(projectId)];
}

export function useSaveRender(projectId: string) {
  const { t } = useTranslation(["media"]);
  return useMutationWithToast((input: RenderInput) => mediaRepo.saveRender(projectId, input), {
    invalidate: renderInvalidate(projectId),
    success: t("render.savedToast"),
  });
}

export function useDeleteRender(projectId: string) {
  const { t } = useTranslation(["media"]);
  return useMutationWithToast((render: Render) => mediaRepo.deleteRender(render), {
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

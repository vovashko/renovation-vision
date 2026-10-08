import { queryOptions, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { translateWorkError } from "../domain/errors";
import { roomViewRepo, type RoomMaterialInput, type RoomWarningInput } from "../data/room-view.repo";

// The room view's queries and mutations (issue #56). Every key starts with `keys.roomView(projectId)`, so one
// invalidation refreshes a room's works, materials and warnings together (a material's status decides whether a
// warning is still open).

export const roomTasksQuery = (projectId: string, roomId: string) =>
  queryOptions({ queryKey: [...keys.roomView(projectId), roomId, "tasks"], queryFn: () => roomViewRepo.listRoomTasks(roomId) });
export const roomMaterialsQuery = (projectId: string, roomId: string) =>
  queryOptions({ queryKey: [...keys.roomView(projectId), roomId, "materials"], queryFn: () => roomViewRepo.listRoomMaterials(roomId) });
export const roomWarningsQuery = (projectId: string, roomId: string) =>
  queryOptions({ queryKey: [...keys.roomView(projectId), roomId, "warnings"], queryFn: () => roomViewRepo.listRoomWarnings(roomId) });

export const useRoomTasks = (projectId: string, roomId: string) => useQuery(roomTasksQuery(projectId, roomId));
export const useRoomMaterials = (projectId: string, roomId: string) => useQuery(roomMaterialsQuery(projectId, roomId));
export const useRoomWarnings = (projectId: string, roomId: string) => useQuery(roomWarningsQuery(projectId, roomId));

// The database triggers behind these writes also move room/stage progress, the activity log and notifications.
const invalidation = (projectId: string) => [
  keys.roomView(projectId),
  keys.rooms(projectId),
  keys.stages(projectId),
  keys.project(projectId),
  keys.projects,
  keys.activity(projectId),
  keys.notifications(projectId),
];

export function useSaveMaterial(projectId: string, roomId: string) {
  const { t } = useTranslation(["work"]);
  return useMutationWithToast((input: RoomMaterialInput) => roomViewRepo.saveMaterial(projectId, roomId, input), {
    invalidate: invalidation(projectId),
    success: t("work:materials.saved"),
    error: (error) => translateWorkError((key, params) => t(key as never, params), error),
  });
}

export function useDeleteMaterial(projectId: string) {
  const { t } = useTranslation(["work"]);
  return useMutationWithToast((materialId: string) => roomViewRepo.deleteMaterial(materialId), {
    invalidate: invalidation(projectId),
    success: t("work:materials.removed"),
    error: (error) => translateWorkError((key, params) => t(key as never, params), error),
  });
}

export function useSaveWarning(projectId: string, roomId: string) {
  const { t } = useTranslation(["work"]);
  return useMutationWithToast((input: RoomWarningInput) => roomViewRepo.saveWarning(projectId, roomId, input), {
    invalidate: invalidation(projectId),
    success: t("work:warnings.saved"),
    error: (error) => translateWorkError((key, params) => t(key as never, params), error),
  });
}

export function useDeleteWarning(projectId: string) {
  const { t } = useTranslation(["work"]);
  return useMutationWithToast((warningId: string) => roomViewRepo.deleteWarning(warningId), {
    invalidate: invalidation(projectId),
    success: t("work:warnings.removed"),
    error: (error) => translateWorkError((key, params) => t(key as never, params), error),
  });
}

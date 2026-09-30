import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { translateWorkError } from "../domain/errors";
import { workRepo, type RoomInput, type StageInput, type TaskInput } from "../data/work.repo";
import type { Task } from "@/lib/database.types";

// TanStack Query mutations for stages, tasks and rooms (the "controllers" — README → Architecture).
// Every mutation also invalidates the project summary, activity log and notifications, since the
// database triggers behind stage/room/task writes update those too (mirrors the old `useSave` shim).
const projectInvalidation = (projectId: string) => [
  keys.project(projectId),
  keys.projects,
  keys.activity(projectId),
  keys.notifications(projectId),
];

export function useSaveStage(projectId: string) {
  const { t } = useTranslation(["work"]);
  return useMutationWithToast((input: StageInput) => workRepo.saveStage(projectId, input), {
    invalidate: [keys.stages(projectId), ...projectInvalidation(projectId)],
    success: t("work:stageForm.saved"),
    error: (error) => translateWorkError((key, params) => t(key as never, params), error),
  });
}

export function useDeleteStage(projectId: string) {
  const { t } = useTranslation(["work"]);
  return useMutationWithToast((stageId: string) => workRepo.deleteStage(stageId), {
    invalidate: [keys.stages(projectId), ...projectInvalidation(projectId)],
    success: t("work:stageForm.removed"),
    error: (error) => translateWorkError((key, params) => t(key as never, params), error),
  });
}

export function useSaveTask(projectId: string) {
  const { t } = useTranslation(["work"]);
  return useMutationWithToast((input: TaskInput) => workRepo.saveTask(projectId, input), {
    invalidate: [keys.stages(projectId), keys.rooms(projectId), ...projectInvalidation(projectId)],
    error: (error) => translateWorkError((key, params) => t(key as never, params), error),
  });
}

export function useDeleteTask(projectId: string) {
  const { t } = useTranslation(["work"]);
  return useMutationWithToast((task: Pick<Task, "id" | "name">) => workRepo.deleteTask(task.id), {
    invalidate: [keys.stages(projectId), keys.rooms(projectId), ...projectInvalidation(projectId)],
    success: (task) => t("work:stageForm.taskRemoved", { name: task.name }),
    error: (error) => translateWorkError((key, params) => t(key as never, params), error),
  });
}

export function useSaveRoom(projectId: string) {
  const { t } = useTranslation(["work"]);
  return useMutationWithToast((input: RoomInput) => workRepo.saveRoom(projectId, input), {
    invalidate: [keys.rooms(projectId), ...projectInvalidation(projectId)],
    success: (input) => t("work:roomForm.saved", { name: input.name ?? "" }),
    error: (error) => translateWorkError((key, params) => t(key as never, params), error),
  });
}

export function useDeleteRoom(projectId: string) {
  const { t } = useTranslation(["work"]);
  return useMutationWithToast((roomId: string) => workRepo.deleteRoom(roomId), {
    invalidate: [keys.rooms(projectId), keys.stages(projectId), ...projectInvalidation(projectId)],
    success: t("work:roomForm.removed"),
    error: (error) => translateWorkError((key, params) => t(key as never, params), error),
  });
}

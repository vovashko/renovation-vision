import { queryOptions, useQuery } from "@tanstack/react-query";
import { keys } from "@/shared/query-keys";
import { workRepo } from "../data/work.repo";

// `project` itself belongs to the projects feature (`@/features/projects/hooks`); this file only
// owns stages and rooms, keyed the same way (`@/shared/query-keys`) so invalidation stays shared.

/** Query options, shared by the hooks and route loaders that prefetch during SSR (T21). */
export const stagesQuery = (projectId: string) =>
  queryOptions({ queryKey: keys.stages(projectId), queryFn: () => workRepo.listStages(projectId) });
export const roomsQuery = (projectId: string) =>
  queryOptions({ queryKey: keys.rooms(projectId), queryFn: () => workRepo.listRooms(projectId) });

/** Planned cost per stage id (managers). Nests under `keys.stages`, so saving a stage refreshes it. */
export const stageBudgetsQuery = (projectId: string) =>
  queryOptions({ queryKey: [...keys.stages(projectId), "budgets"], queryFn: () => workRepo.listStageBudgets(projectId) });
export const useStageBudgets = (projectId: string, enabled = true) => useQuery({ ...stageBudgetsQuery(projectId), enabled });

export const useStages = (projectId: string) => useQuery(stagesQuery(projectId));

export const useRooms = (projectId: string) => useQuery(roomsQuery(projectId));

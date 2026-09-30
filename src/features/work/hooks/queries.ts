import { useQuery } from "@tanstack/react-query";
import { keys } from "@/shared/query-keys";
import { workRepo } from "../data/work.repo";

// `project` itself belongs to the projects feature (`@/features/projects/hooks`); this file only
// owns stages and rooms, keyed the same way (`@/shared/query-keys`) so invalidation stays shared.

export const useStages = (projectId: string) =>
  useQuery({ queryKey: keys.stages(projectId), queryFn: () => workRepo.listStages(projectId) });

export const useRooms = (projectId: string) => useQuery({ queryKey: keys.rooms(projectId), queryFn: () => workRepo.listRooms(projectId) });

import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/queries";
import { workRepo } from "../data/work.repo";

// Same query keys as `@/lib/queries` (imported, not redefined) so the cache stays shared with
// features that haven't moved off the old shim yet — see README → Architecture.

export const useProject = (projectId: string | undefined) =>
  useQuery({ queryKey: keys.project(projectId ?? ""), queryFn: () => workRepo.getProject(projectId!), enabled: !!projectId });

export const useStages = (projectId: string) =>
  useQuery({ queryKey: keys.stages(projectId), queryFn: () => workRepo.listStages(projectId) });

export const useRooms = (projectId: string) => useQuery({ queryKey: keys.rooms(projectId), queryFn: () => workRepo.listRooms(projectId) });

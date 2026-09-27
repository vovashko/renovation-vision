import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/queries";
import { commsRepo } from "@/features/comms/data/comms.repo";

export const useActivity = (projectId: string) =>
  useQuery({ queryKey: keys.activity(projectId), queryFn: () => commsRepo.listActivity(projectId) });

import { useQuery } from "@tanstack/react-query";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { commsRepo } from "@/features/comms/data/comms.repo";

export const useNotifications = (projectId: string) =>
  useQuery({ queryKey: keys.notifications(projectId), queryFn: () => commsRepo.listNotifications(projectId) });

/** Sends an announcement to every client on the project (fanned out server-side, one row per client). */
export function useNotifyClients(projectId: string, opts: { success?: string } = {}) {
  return useMutationWithToast(
    (vars: { title: string; body: string; link: string | null }) => commsRepo.notifyClients(projectId, vars.title, vars.body, vars.link),
    { invalidate: [keys.notifications(projectId), keys.activity(projectId)], success: opts.success },
  );
}

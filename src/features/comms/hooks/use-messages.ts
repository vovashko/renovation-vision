import { useQuery } from "@tanstack/react-query";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { commsRepo } from "@/features/comms/data/comms.repo";

export const useMessages = (projectId: string) =>
  useQuery({ queryKey: keys.messages(projectId), queryFn: () => commsRepo.listMessages(projectId) });

/** Sends a chat message, with an optional attachment. */
export function useSendMessage(projectId: string) {
  return useMutationWithToast((vars: { body: string; file?: File | null }) => commsRepo.sendMessage(projectId, vars.body, vars.file), {
    invalidate: [keys.messages(projectId)],
  });
}

/** Marks the chat read for the current user. Silent: no success toast on every view. */
export function useMarkChatRead(projectId: string) {
  return useMutationWithToast(() => commsRepo.markChatRead(projectId), {
    invalidate: [keys.members(projectId)],
  });
}

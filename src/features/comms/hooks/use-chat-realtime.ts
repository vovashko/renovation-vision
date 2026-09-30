import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { keys } from "@/shared/query-keys";
import { commsRepo } from "@/features/comms/data/comms.repo";

/**
 * Subscribes to `postgres_changes` on `messages` for this project and invalidates the messages
 * query on any change, so the chat stays live without a reload. Unsubscribes on unmount or when
 * `projectId` changes.
 */
export function useChatRealtime(projectId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    return commsRepo.subscribeMessages(projectId, () => void qc.invalidateQueries({ queryKey: keys.messages(projectId) }));
  }, [projectId, qc]);
}

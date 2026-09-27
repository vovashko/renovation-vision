import { useEffect, useState } from "react";
import { commsRepo, type PresenceMember } from "@/features/comms/data/comms.repo";

export type { PresenceMember };

/**
 * Joins `presence:project:<projectId>` as `me` and returns the ids of everyone currently online
 * (including the caller). Passing `null` for `me` (not signed in yet) leaves the list empty and
 * joins no channel.
 */
export function usePresence(projectId: string, me: PresenceMember | null): string[] {
  const [online, setOnline] = useState<string[]>([]);
  const { id, name, role } = me ?? {};

  useEffect(() => {
    if (!id || !name || !role) return;
    return commsRepo.joinPresence(projectId, { id, name, role }, setOnline);
  }, [projectId, id, name, role]);

  return online;
}

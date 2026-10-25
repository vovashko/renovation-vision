import { usePendingChangeRequestCount } from "@/features/change-requests/hooks";
import type { ProjectRole } from "@/lib/database.types";

/**
 * The count badges on navigation items, by nav item key. Only clients get one today: the number of change
 * requests waiting for their approval, on Budget (managers see the lists themselves). An item without an entry,
 * or with 0, shows no badge.
 */
export function useNavCounts(projectId: string | undefined, role: ProjectRole): Record<string, number> {
  const { data: pending = 0 } = usePendingChangeRequestCount(projectId, role === "client");
  return role === "client" ? { budget: pending } : {};
}

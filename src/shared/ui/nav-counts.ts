import { usePendingDecisionCount } from "@/features/decisions/hooks";
import type { ProjectRole } from "@/lib/database.types";

/**
 * The count badges on navigation items, by nav item key. Only clients get one today: the number of
 * decisions waiting for them (managers see the list's own counters instead). An item without an entry,
 * or with 0, shows no badge.
 */
export function useNavCounts(projectId: string | undefined, role: ProjectRole): Record<string, number> {
  const { data: pending = 0 } = usePendingDecisionCount(projectId, role === "client");
  return role === "client" ? { decisions: pending } : {};
}

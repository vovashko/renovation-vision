import { isDemo } from "./supabase";
import { parseDate } from "./format";
import type { Status } from "@/components/ui/status";

/**
 * Attention flag (v5 status model): an orange flag shown next to the progress state.
 * Computed from the data, never stored:
 *   - late:        today > end date and the state is not "done" (stages only; rooms have no dates)
 *   - over budget: spent > budget
 */

/** The demo data is set on Apr 20, 2026, the same "today" the client app's demo uses. */
export const DEMO_TODAY = new Date(2026, 3, 20, 12);

export function projectToday(): Date {
  return isDemo ? DEMO_TODAY : new Date();
}

const DAY = 86_400_000;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole days past the end date ('YYYY-MM-DD'), or 0 when on time or done. */
export function daysLate(item: { end_date: string; status: Status }, today: Date = projectToday()): number {
  if (item.status === "done") return 0;
  const diff = Math.floor((dayStart(today) - dayStart(parseDate(item.end_date))) / DAY);
  return diff > 0 ? diff : 0;
}

export function lateLabel(days: number) {
  return `${days} ${days === 1 ? "day" : "days"} late`;
}

/** Budget attention: `over` when spent exceeds the budget, with the overrun and use in percent. */
export function budgetStatus(p: { budget: number; spent: number }) {
  const over = p.budget > 0 && p.spent > p.budget;
  return {
    over,
    overPct: over ? Math.round(((p.spent - p.budget) / p.budget) * 100) : 0,
    usedPct: p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : 0,
  };
}

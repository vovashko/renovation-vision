import { parseDate } from "./dates";
import type { Status } from "./status";

/**
 * Attention flag (v5 status model): an orange flag shown next to the progress state.
 * Computed from the data, never stored:
 *   - late:        today > end date and the state is not "done" (stages only; rooms have no dates)
 *   - over budget: spent > budget
 * The "N days late" text is `common:attention.daysLate` (pluralized: pass `{ count }`).
 */

export function projectToday(): Date {
  return new Date();
}

const DAY = 86_400_000;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Days an item is past its end date; 0 once it is done or at 100% (a finished stage is never late). */
export function daysLate(item: { end_date: string; status: Status; progress?: number }, today: Date = projectToday()): number {
  if (item.status === "done" || (item.progress ?? 0) >= 100) return 0;
  const diff = Math.floor((dayStart(today) - dayStart(parseDate(item.end_date))) / DAY);
  return diff > 0 ? diff : 0;
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

/** Whole days from today to a date ('YYYY-MM-DD'); negative once it has passed. */
export function daysUntil(date: string, today: Date = projectToday()): number {
  return Math.round((dayStart(parseDate(date)) - dayStart(today)) / DAY);
}

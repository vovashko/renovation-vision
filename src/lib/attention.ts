import { project, type Stage } from "@/lib/renovation-data";
import { PROJECT_TODAY } from "@/lib/media-data";

/**
 * Attention flag (v5 status model): an orange flag shown *in addition to* the progress state.
 * It is computed from the data, never stored:
 *   - over budget: spent > budget
 *   - late:        today > end date and the state is not "done"
 */

const DAY = 86_400_000;
const projectYear = new Date(project.startDate).getFullYear();
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Stage dates are stored as "Apr 24"; they fall in the project's year. */
function parseStageDate(label: string) {
  return new Date(`${label}, ${projectYear}`);
}

/** Whole days past the end date, or 0 when on time or done. */
export function daysLate(item: Pick<Stage, "end" | "status">, today: Date = PROJECT_TODAY): number {
  if (item.status === "done") return 0;
  const diff = Math.floor((dayStart(today) - dayStart(parseStageDate(item.end))) / DAY);
  return diff > 0 ? diff : 0;
}

export function lateLabel(days: number) {
  return `${days} ${days === 1 ? "day" : "days"} late`;
}

/** Budget attention: `over` when spent exceeds the budget, with the overrun in percent. */
export function budgetStatus(p: { budget: number; spent: number } = project) {
  const over = p.spent > p.budget;
  return {
    over,
    overPct: over ? Math.round(((p.spent - p.budget) / p.budget) * 100) : 0,
    usedPct: Math.round((p.spent / p.budget) * 100),
  };
}

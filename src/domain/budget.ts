import { budgetStatus } from "./attention";

/**
 * Budget page summary, extracted from the page's inline math so it can be unit tested.
 * Reuses `budgetStatus` (the shared over-budget attention flag) rather than re-deriving it.
 */
export function budgetSummary(project: { budget: number; spent: number }) {
  const status = budgetStatus(project);
  return {
    usedPct: status.usedPct,
    remaining: project.budget - project.spent,
    over: status.over,
    overPct: status.overPct,
  };
}

/** Sum of an expenses list's amounts (the budget table's "Total spent" row). */
export function expensesTotal(expenses: { amount: number }[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Budget deviation: the projected (current) budget minus the planned one. Positive when the project is
 * now expected to cost more, negative when less, 0 when equal, so the UI can hide it.
 */
export function budgetDeviation(planned: number, projected: number): number {
  return Math.round((projected - planned) * 100) / 100 || 0;
}

import { budgetStatus } from "@/lib/attention";

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

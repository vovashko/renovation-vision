import { EXPENSE_CATEGORIES } from "./schemas";
import type { CostCategory } from "@/lib/database.types";

// The cost breakdown (T42), as `project_cost_breakdown(project)` returns it: aggregates per stage and per cost
// category. A client gets the visible stages and `committed: null`; a manager gets every stage with committed.
// Pure: no React, no Supabase.

export type StageCost = {
  stage_id: string;
  name: string;
  planned: number;
  spent: number;
  /** Materials ordered or delivered but not yet paid through an expense. Null for a client. */
  committed: number | null;
};
export type CategoryCost = { category: CostCategory; spent: number };
export type CostBreakdown = { stages: StageCost[]; categories: CategoryCost[] };

const cents = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => cents(Number(v ?? 0) || 0);

/** The RPC's JSON (numeric values may arrive as numbers or strings) as typed numbers; unknown categories are dropped. */
export function parseCostBreakdown(raw: unknown): CostBreakdown {
  const json = (raw ?? {}) as { stages?: Record<string, unknown>[]; categories?: Record<string, unknown>[] };
  return {
    stages: (json.stages ?? []).map((s) => ({
      stage_id: String(s.stage_id),
      name: String(s.name ?? ""),
      planned: num(s.planned),
      spent: num(s.spent),
      committed: s.committed == null ? null : num(s.committed),
    })),
    categories: (json.categories ?? [])
      .filter((c) => (EXPENSE_CATEGORIES as readonly string[]).includes(String(c.category)))
      .map((c) => ({ category: c.category as CostCategory, spent: num(c.spent) }))
      .sort((a, b) => EXPENSE_CATEGORIES.indexOf(a.category) - EXPENSE_CATEGORIES.indexOf(b.category)),
  };
}

/** planned − spent − committed (negative when over). Committed counts as zero when it isn't known. */
export const stageRemaining = (s: StageCost): number => cents(s.planned - s.spent - (s.committed ?? 0));

/**
 * The manager's attention flag: spent + committed is more than the stage's planned cost. A stage with no planned
 * cost (0) has no budget to be over, and a client never sees committed, so neither is flagged.
 */
export const isStageOverBudget = (s: StageCost): boolean =>
  s.committed !== null && s.planned > 0 && cents(s.spent + s.committed) > s.planned;

export type CostTotals = { planned: number; spent: number; committed: number; remaining: number };

export function stageCostTotals(stages: StageCost[]): CostTotals {
  const planned = cents(stages.reduce((n, s) => n + s.planned, 0));
  const spent = cents(stages.reduce((n, s) => n + s.spent, 0));
  const committed = cents(stages.reduce((n, s) => n + (s.committed ?? 0), 0));
  return { planned, spent, committed, remaining: cents(planned - spent - committed) };
}

/** A category's share of the spent total, 0–100 (for the bars). */
export function categoryShare(categories: CategoryCost[], c: CategoryCost): number {
  const total = categories.reduce((n, x) => n + x.spent, 0);
  return total > 0 ? Math.round((c.spent / total) * 100) : 0;
}

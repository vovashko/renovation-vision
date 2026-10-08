// What accepting a case would do to the project's totals. Pure: money is formatted by the caller
// (`useFormat().money`), dates by `useFormat().date`. Mirrors `public.accept_decision`: budget + cost_delta,
// target_date + days_delta (calendar days), a missing end date stays missing. Negative deltas are savings.

export type ImpactProject = { budget: number; target_date: string | null };
export type ImpactCase = { cost_delta: number; days_delta: number };

export type DecisionImpact = {
  budget: { from: number; to: number; delta: number };
  /** `from`/`to` are 'YYYY-MM-DD', or null when the project has no end date (the days can't be applied). */
  end: { from: string | null; to: string | null; days: number };
  /** Accepting would take the budget below zero (the database refuses that). */
  budgetBelowZero: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100 || 0;

/** `addDays("2026-06-10", 4)` → "2026-06-14"; negative days go back. Calendar arithmetic in UTC, so no DST drift. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The preview shown before deciding, computed from the project's CURRENT budget and end date. */
export function decisionImpact(project: ImpactProject, decision: ImpactCase): DecisionImpact {
  const to = round2(project.budget + decision.cost_delta);
  return {
    budget: { from: round2(project.budget), to, delta: round2(decision.cost_delta) },
    end: {
      from: project.target_date,
      to: project.target_date ? addDays(project.target_date, decision.days_delta) : null,
      days: decision.days_delta,
    },
    budgetBelowZero: to < 0,
  };
}

/** True when accepting changes nothing (no cost and no days). */
export const hasNoImpact = (decision: ImpactCase) => decision.cost_delta === 0 && decision.days_delta === 0;

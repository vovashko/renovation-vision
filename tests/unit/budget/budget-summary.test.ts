import { describe, it, expect } from "vitest";
import { budgetSummary, expensesTotal } from "@/lib/budget";

describe("budgetSummary", () => {
  it("handles a zero budget", () => {
    const s = budgetSummary({ budget: 0, spent: 0 });
    expect(s).toEqual({ usedPct: 0, remaining: 0, over: false, overPct: 0 });
  });

  it("is under budget", () => {
    const s = budgetSummary({ budget: 1000, spent: 400 });
    expect(s.usedPct).toBe(40);
    expect(s.remaining).toBe(600);
    expect(s.over).toBe(false);
    expect(s.overPct).toBe(0);
  });

  it("is exactly at budget", () => {
    const s = budgetSummary({ budget: 1000, spent: 1000 });
    expect(s.usedPct).toBe(100);
    expect(s.remaining).toBe(0);
    expect(s.over).toBe(false);
    expect(s.overPct).toBe(0);
  });

  it("is over budget, with rounded overrun and use", () => {
    const s = budgetSummary({ budget: 850, spent: 884 });
    expect(s.over).toBe(true);
    expect(s.overPct).toBe(4); // (884 - 850) / 850 = 4.0%
    expect(s.usedPct).toBe(104); // 884 / 850 = 104.0%
    expect(s.remaining).toBe(-34);
  });
});

describe("expensesTotal", () => {
  it("sums the amounts", () => {
    expect(expensesTotal([{ amount: 100 }, { amount: 250.5 }, { amount: 10 }])).toBe(360.5);
  });

  it("is 0 for an empty list", () => {
    expect(expensesTotal([])).toBe(0);
  });
});

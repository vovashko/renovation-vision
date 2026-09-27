import { describe, it, expect } from "vitest";
import { daysLate, daysUntil, budgetStatus } from "@/domain/attention";

describe("daysLate", () => {
  const today = new Date(2026, 3, 20); // Apr 20, 2026

  it("is 0 when the item is done, even if past its end date", () => {
    expect(daysLate({ end_date: "2026-04-01", status: "done" }, today)).toBe(0);
  });

  it("is 0 when the end date is today or in the future", () => {
    expect(daysLate({ end_date: "2026-04-20", status: "progress" }, today)).toBe(0);
    expect(daysLate({ end_date: "2026-04-25", status: "progress" }, today)).toBe(0);
  });

  it("counts whole days past the end date", () => {
    expect(daysLate({ end_date: "2026-04-15", status: "progress" }, today)).toBe(5);
  });
});

describe("daysUntil", () => {
  const today = new Date(2026, 3, 20); // Apr 20, 2026

  it("is 0 for today", () => {
    expect(daysUntil("2026-04-20", today)).toBe(0);
  });

  it("is positive for a future date", () => {
    expect(daysUntil("2026-04-25", today)).toBe(5);
  });

  it("is negative for a past date", () => {
    expect(daysUntil("2026-04-15", today)).toBe(-5);
  });
});

describe("budgetStatus", () => {
  it("is not over when budget is 0", () => {
    const s = budgetStatus({ budget: 0, spent: 100 });
    expect(s.over).toBe(false);
    expect(s.overPct).toBe(0);
    expect(s.usedPct).toBe(0);
  });

  it("is not over when spent is under budget", () => {
    const s = budgetStatus({ budget: 1000, spent: 500 });
    expect(s.over).toBe(false);
    expect(s.overPct).toBe(0);
    expect(s.usedPct).toBe(50);
  });

  it("is over when spent exceeds budget, with rounded overrun and use", () => {
    const s = budgetStatus({ budget: 300, spent: 400 });
    expect(s.over).toBe(true);
    expect(s.overPct).toBe(33); // (400 - 300) / 300 = 33.33% rounded
    expect(s.usedPct).toBe(133); // 400 / 300 = 133.33% rounded
  });
});

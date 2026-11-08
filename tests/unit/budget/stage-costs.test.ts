import { describe, expect, it } from "vitest";
import {
  categoryShare,
  isStageOverBudget,
  parseCostBreakdown,
  stageCostTotals,
  stageRemaining,
  type StageCost,
} from "@/features/budget/domain/stage-costs";

const stage = (over: Partial<StageCost> = {}): StageCost => ({
  stage_id: "s1",
  name: "Floor",
  planned: 1000,
  spent: 400,
  committed: 200,
  ...over,
});

describe("stageRemaining", () => {
  it("is planned − spent − committed, negative when over", () => {
    expect(stageRemaining(stage())).toBe(400);
    expect(stageRemaining(stage({ spent: 900 }))).toBe(-100);
  });

  it("treats an unknown committed (a client) as zero", () => {
    expect(stageRemaining(stage({ committed: null }))).toBe(600);
  });

  it("does not leak float noise", () => {
    expect(stageRemaining(stage({ planned: 0.3, spent: 0.1, committed: 0.1 }))).toBe(0.1);
  });
});

describe("isStageOverBudget", () => {
  it("flags spent + committed above planned", () => {
    expect(isStageOverBudget(stage({ spent: 801 }))).toBe(true);
  });

  it("does not flag exactly on budget or under it", () => {
    expect(isStageOverBudget(stage({ spent: 800 }))).toBe(false);
    expect(isStageOverBudget(stage())).toBe(false);
  });

  it("counts committed, not just spent", () => {
    expect(isStageOverBudget(stage({ spent: 100, committed: 950 }))).toBe(true);
  });

  it("never flags a stage with no planned cost", () => {
    expect(isStageOverBudget(stage({ planned: 0, spent: 50 }))).toBe(false);
  });

  it("never flags for a client, who gets no committed", () => {
    expect(isStageOverBudget(stage({ committed: null, spent: 5000 }))).toBe(false);
  });
});

describe("stageCostTotals", () => {
  it("sums every column and the remaining", () => {
    const totals = stageCostTotals([stage(), stage({ stage_id: "s2", planned: 500, spent: 100, committed: null })]);
    expect(totals).toEqual({ planned: 1500, spent: 500, committed: 200, remaining: 800 });
  });

  it("is zero without stages", () => {
    expect(stageCostTotals([])).toEqual({ planned: 0, spent: 0, committed: 0, remaining: 0 });
  });
});

describe("parseCostBreakdown", () => {
  it("types the RPC's JSON: numbers from strings, null committed for a client, categories in the form's order", () => {
    const parsed = parseCostBreakdown({
      stages: [{ stage_id: "a", name: "Demolition", planned: "1500.50", spent: 20, committed: null }],
      categories: [
        { category: "permits", spent: "10" },
        { category: "labour", spent: 30 },
        { category: "snacks", spent: 5 },
      ],
    });
    expect(parsed.stages).toEqual([{ stage_id: "a", name: "Demolition", planned: 1500.5, spent: 20, committed: null }]);
    expect(parsed.categories).toEqual([
      { category: "labour", spent: 30 },
      { category: "permits", spent: 10 },
    ]);
  });

  it("copes with an empty result", () => {
    expect(parseCostBreakdown(null)).toEqual({ stages: [], categories: [] });
  });
});

describe("categoryShare", () => {
  it("is each category's percentage of the spent total", () => {
    const categories = [
      { category: "labour" as const, spent: 75 },
      { category: "materials" as const, spent: 25 },
    ];
    expect(categoryShare(categories, categories[0])).toBe(75);
    expect(categoryShare([], { category: "other", spent: 0 })).toBe(0);
  });
});

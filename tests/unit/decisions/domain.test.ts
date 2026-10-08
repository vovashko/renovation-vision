import { describe, expect, it } from "vitest";
import { addDays, decisionImpact, hasNoImpact } from "@/features/decisions/domain/impact";
import {
  canAnswer,
  canAsk,
  canDecide,
  canEdit,
  canReopen,
  DECISION_STATUSES,
  isOpen,
  pendingCount,
  questionCount,
  sortDecisions,
} from "@/features/decisions/domain/status";
import { codeSchema, decisionSchema, messageSchema, rejectSchema } from "@/features/decisions/domain/schemas";
import { formatMoney } from "@/domain/money";

describe("addDays", () => {
  it("adds and subtracts calendar days across month and year ends", () => {
    expect(addDays("2026-06-10", 4)).toBe("2026-06-14");
    expect(addDays("2026-06-10", -3)).toBe("2026-06-07");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("is not thrown off by daylight-saving changes", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2026-06-10", 0)).toBe("2026-06-10");
  });
});

describe("decisionImpact", () => {
  const project = { budget: 84500, target_date: "2026-06-10" };

  it("previews 'z 84 500 zł do 85 380 zł' and the new end date for a cost and a delay", () => {
    const impact = decisionImpact(project, { cost_delta: 880, days_delta: 4 });
    expect(impact.budget).toEqual({ from: 84500, to: 85380, delta: 880 });
    expect(impact.end).toEqual({ from: "2026-06-10", to: "2026-06-14", days: 4 });
    expect(impact.budgetBelowZero).toBe(false);
    expect(formatMoney(impact.budget.from, "PLN", "pl")).toContain("84");
    expect(formatMoney(impact.budget.to, "PLN", "pl", { decimals: 0 }).replace(/\s/g, " ")).toBe("85 380 zł");
  });

  it("handles a saving and time gained (negative deltas)", () => {
    const impact = decisionImpact(project, { cost_delta: -1200.5, days_delta: -3 });
    expect(impact.budget).toEqual({ from: 84500, to: 83299.5, delta: -1200.5 });
    expect(impact.end.to).toBe("2026-06-07");
  });

  it("keeps cents exact", () => {
    expect(decisionImpact({ budget: 0.1, target_date: null }, { cost_delta: 0.2, days_delta: 0 }).budget.to).toBe(0.3);
  });

  it("leaves a missing end date missing (the days can't be applied)", () => {
    const impact = decisionImpact({ budget: 1000, target_date: null }, { cost_delta: 0, days_delta: 5 });
    expect(impact.end).toEqual({ from: null, to: null, days: 5 });
  });

  it("flags a budget that would drop below zero", () => {
    expect(decisionImpact({ budget: 1000, target_date: null }, { cost_delta: -1500, days_delta: 0 }).budgetBelowZero).toBe(true);
    expect(decisionImpact({ budget: 1000, target_date: null }, { cost_delta: -1000, days_delta: 0 }).budgetBelowZero).toBe(false);
  });

  it("reports a case without cost or days as having no impact", () => {
    expect(hasNoImpact({ cost_delta: 0, days_delta: 0 })).toBe(true);
    expect(hasNoImpact({ cost_delta: 0, days_delta: -1 })).toBe(false);
    expect(hasNoImpact({ cost_delta: -1, days_delta: 0 })).toBe(false);
  });
});

describe("the state machine as the UI sees it", () => {
  it("lists the four statuses, open ones first", () => {
    expect(DECISION_STATUSES).toEqual(["pending", "question", "accepted", "rejected"]);
  });

  it("only pending and question cases are open: decidable and editable", () => {
    for (const status of DECISION_STATUSES) {
      const open = status === "pending" || status === "question";
      expect(isOpen(status)).toBe(open);
      expect(canDecide(status)).toBe(open);
      expect(canEdit(status)).toBe(open);
    }
  });

  it("a question is asked while pending, answered while in question, and only a rejected case reopens", () => {
    expect(DECISION_STATUSES.filter(canAsk)).toEqual(["pending"]);
    expect(DECISION_STATUSES.filter(canAnswer)).toEqual(["question"]);
    expect(DECISION_STATUSES.filter(canReopen)).toEqual(["rejected"]);
  });

  it("counts the cases waiting for the investor, and the questions waiting for the manager", () => {
    const cases = [
      { status: "pending" },
      { status: "pending" },
      { status: "question" },
      { status: "accepted" },
      { status: "rejected" },
    ] as const;
    expect(pendingCount([...cases])).toBe(2);
    expect(questionCount([...cases])).toBe(1);
    expect(pendingCount([])).toBe(0);
  });

  it("sorts open cases first, newest first within a status", () => {
    const sorted = sortDecisions([
      { id: "a", status: "accepted", created_at: "2026-10-05T10:00:00Z" },
      { id: "b", status: "pending", created_at: "2026-10-01T10:00:00Z" },
      { id: "c", status: "pending", created_at: "2026-10-03T10:00:00Z" },
      { id: "d", status: "question", created_at: "2026-10-06T10:00:00Z" },
      { id: "e", status: "rejected", created_at: "2026-10-07T10:00:00Z" },
    ] as const);
    expect(sorted.map((d) => d.id)).toEqual(["c", "b", "d", "a", "e"]);
  });
});

describe("decisionSchema", () => {
  const base = { title: "Extra socket", description: "Two more", cost_delta: "880", days_delta: "4", files: [] };

  it("parses a plain case", () => {
    const result = decisionSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ title: "Extra socket", cost_delta: 880, days_delta: 4 });
  });

  it("allows negative values: savings and time gained", () => {
    const result = decisionSchema.safeParse({ ...base, cost_delta: "-1 200,50", days_delta: "-3" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ cost_delta: -1200.5, days_delta: -3 });
  });

  it("accepts a Polish decimal comma, and treats empty as 0", () => {
    const result = decisionSchema.safeParse({ ...base, cost_delta: "12,5", days_delta: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ cost_delta: 12.5, days_delta: 0 });
    const empty = decisionSchema.safeParse({ ...base, cost_delta: "", days_delta: "" });
    expect(empty.success && empty.data.cost_delta).toBe(0);
  });

  it("rejects text, fractions of a day, three decimals and out-of-range values", () => {
    const messages = (patch: Record<string, string>) => {
      const result = decisionSchema.safeParse({ ...base, ...patch });
      return result.success ? [] : result.error.issues.map((i) => i.message);
    };
    expect(messages({ cost_delta: "abc" })).toContain("common:form.invalid");
    expect(messages({ days_delta: "1.5" })).toContain("decisions:form.daysWhole");
    expect(messages({ cost_delta: "10.123" })).toContain("decisions:form.costDecimals");
    expect(messages({ cost_delta: "2000000000" })).toContain("decisions:form.costTooLarge");
    expect(messages({ days_delta: "4000" })).toContain("decisions:form.daysTooLarge");
    expect(messages({ title: "   " })).toContain("common:form.required");
    expect(messages({ title: "x".repeat(161) })).toContain("decisions:form.titleTooLong");
  });

  it("checks the photos' type and size like the media uploads do", () => {
    const png = new File(["x"], "a.png", { type: "image/png" });
    expect(decisionSchema.safeParse({ ...base, files: [png] }).success).toBe(true);
    const pdf = new File(["x"], "a.pdf", { type: "application/pdf" });
    const result = decisionSchema.safeParse({ ...base, files: [pdf] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("media:upload.fileTypeNotAllowed");
    const huge = new File(["x"], "b.jpg", { type: "image/jpeg" });
    Object.defineProperty(huge, "size", { value: 16 * 1024 * 1024 });
    const tooBig = decisionSchema.safeParse({ ...base, files: [huge] });
    expect(!tooBig.success && tooBig.error.issues[0].message).toBe("media:upload.fileTooLarge");
  });
});

describe("messageSchema / rejectSchema / codeSchema", () => {
  it("a question or answer is trimmed and required", () => {
    expect(messageSchema.safeParse({ text: "  Is it final?  " })).toMatchObject({ success: true, data: { text: "Is it final?" } });
    expect(messageSchema.safeParse({ text: "   " }).success).toBe(false);
    expect(messageSchema.safeParse({ text: "x".repeat(2001) }).success).toBe(false);
  });

  it("a rejection needs a reason, with its own message", () => {
    const result = rejectSchema.safeParse({ text: " " });
    expect(!result.success && result.error.issues[0].message).toBe("decisions:form.reasonRequired");
    expect(rejectSchema.safeParse({ text: "Too expensive" }).success).toBe(true);
  });

  it("the confirmation code is exactly six digits", () => {
    expect(codeSchema.safeParse({ code: "012345" }).success).toBe(true);
    for (const code of ["12345", "1234567", "12345a", "12 345", ""]) expect(codeSchema.safeParse({ code }).success, code).toBe(false);
  });
});

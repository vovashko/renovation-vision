import { describe, expect, it } from "vitest";
import { addDays, requestImpact } from "@/features/change-requests/domain/impact";
import { isReminderDue, REMINDER_AFTER_HOURS } from "@/features/change-requests/domain/reminder";
import { changeRequestSchema, kindOf, rejectSchema } from "@/features/change-requests/domain/schemas";
import {
  approvalsCard,
  canDecide,
  canEdit,
  canReopen,
  groupRequests,
  homeOf,
  inPlace,
  pendingByStage,
  pendingCount,
} from "@/features/change-requests/domain/status";
import type { ChangeRequest } from "@/lib/database.types";

function request(over: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id: "r1",
    project_id: "p1",
    title: "Extra socket",
    description: "",
    cost_delta: 880,
    days_delta: 0,
    stage_id: null,
    status: "pending",
    created_by: "u1",
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
    decided_by: null,
    decided_at: null,
    decision_reason: "",
    pending_since: "2026-10-01T10:00:00Z",
    ...over,
  };
}

describe("requestImpact", () => {
  it("adds the cost and the days to the current values", () => {
    expect(requestImpact({ budget: 120000, target_date: "2026-03-03" }, { cost_delta: 8800, days_delta: 2 })).toEqual({
      budget: { from: 120000, to: 128800, delta: 8800 },
      end: { from: "2026-03-03", to: "2026-03-05", days: 2 },
      budgetBelowZero: false,
    });
  });

  it("handles savings, a missing end date and a budget below zero", () => {
    const impact = requestImpact({ budget: 100, target_date: null }, { cost_delta: -200.5, days_delta: -3 });
    expect(impact.budget.to).toBe(-100.5);
    expect(impact.budgetBelowZero).toBe(true);
    expect(impact.end).toEqual({ from: null, to: null, days: -3 });
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("changeRequestSchema", () => {
  const base = { title: "Extra socket", description: "", cost_delta: null, days_delta: "", stage_id: "" };

  it("a cost request needs a cost; the hidden days count as 0", () => {
    expect(changeRequestSchema.safeParse({ ...base, kind: "cost" }).success).toBe(false);
    const ok = changeRequestSchema.parse({ ...base, kind: "cost", cost_delta: -150.25, days_delta: "4" });
    expect(ok).toMatchObject({ cost_delta: -150.25, days_delta: 0, stage_id: null });
  });

  it("a days request needs whole days; the hidden cost counts as 0", () => {
    expect(changeRequestSchema.safeParse({ ...base, kind: "days", days_delta: "1.5" }).success).toBe(false);
    expect(changeRequestSchema.safeParse({ ...base, kind: "days" }).success).toBe(false);
    expect(changeRequestSchema.parse({ ...base, kind: "days", cost_delta: 500, days_delta: "-3" })).toMatchObject({
      cost_delta: 0,
      days_delta: -3,
    });
  });

  it("both: either may be zero, not both; the stage id passes through", () => {
    expect(changeRequestSchema.safeParse({ ...base, kind: "both" }).success).toBe(false);
    expect(changeRequestSchema.parse({ ...base, kind: "both", days_delta: "2", stage_id: "s1" })).toMatchObject({
      cost_delta: 0,
      days_delta: 2,
      stage_id: "s1",
    });
  });

  it("knows the kind of an existing request, and a reason is required to reject", () => {
    expect(kindOf({ cost_delta: 1, days_delta: 0 })).toBe("cost");
    expect(kindOf({ cost_delta: 0, days_delta: 2 })).toBe("days");
    expect(kindOf({ cost_delta: 1, days_delta: 2 })).toBe("both");
    expect(rejectSchema.safeParse({ text: "  " }).success).toBe(false);
  });
});

describe("status and selectors", () => {
  const cost = request({ id: "cost", cost_delta: 100, days_delta: 0, created_at: "2026-10-01T10:00:00Z" });
  const days = request({ id: "days", cost_delta: 0, days_delta: 3, created_at: "2026-10-03T10:00:00Z", stage_id: "s1" });
  const both = request({ id: "both", cost_delta: 50, days_delta: 2, created_at: "2026-10-02T10:00:00Z", stage_id: "s1" });
  const approved = request({ id: "ok", status: "accepted", decided_at: "2026-10-05T10:00:00Z", stage_id: "s2" });
  const rejected = request({ id: "no", status: "rejected", decided_at: "2026-10-04T10:00:00Z" });
  const all = [cost, days, both, approved, rejected];

  it("Budget lists cost changes, Progress day changes; a request with both is in both", () => {
    expect(inPlace(all, "budget").map((r) => r.id)).toEqual(["cost", "both", "ok", "no"]);
    expect(inPlace(all, "progress").map((r) => r.id)).toEqual(["days", "both"]);
    expect(homeOf(days)).toBe("progress");
    expect(homeOf(both)).toBe("budget");
  });

  it("groups pending first (newest first), then the history (latest decision first)", () => {
    const { pending, history } = groupRequests(all);
    expect(pending.map((r) => r.id)).toEqual(["days", "both", "cost"]);
    expect(history.map((r) => r.id)).toEqual(["ok", "no"]);
  });

  it("counts pending requests per stage and overall; an old `question` row counts as pending", () => {
    expect(pendingByStage(all)).toEqual({ s1: 2 });
    expect(pendingCount([...all, request({ status: "question" })])).toBe(4);
  });

  it("the approvals card: the count and the newest three, or nothing when none waits", () => {
    const more = [...all, request({ id: "new", created_at: "2026-10-09T10:00:00Z" })];
    expect(approvalsCard(more)).toEqual({ count: 4, newest: [more[5], days, both] });
    expect(approvalsCard([approved, rejected])).toBeNull();
  });

  it("only a pending request is edited or decided; only a rejected one is reopened", () => {
    expect([canEdit("pending"), canDecide("pending"), canReopen("pending")]).toEqual([true, true, false]);
    expect([canEdit("accepted"), canDecide("accepted"), canReopen("accepted")]).toEqual([false, false, false]);
    expect([canEdit("rejected"), canDecide("rejected"), canReopen("rejected")]).toEqual([false, false, true]);
  });
});

describe("isReminderDue", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

  it(`is due ${REMINDER_AFTER_HOURS} hours after the request started waiting, once`, () => {
    expect(isReminderDue({ status: "pending", pending_since: hoursAgo(24), reminded_at: null }, now)).toBe(true);
    expect(isReminderDue({ status: "pending", pending_since: hoursAgo(23.9), reminded_at: null }, now)).toBe(false);
    expect(isReminderDue({ status: "pending", pending_since: hoursAgo(48), reminded_at: hoursAgo(24) }, now)).toBe(false);
  });

  it("never for a decided request or one without pending_since", () => {
    expect(isReminderDue({ status: "accepted", pending_since: hoursAgo(48), reminded_at: null }, now)).toBe(false);
    expect(isReminderDue({ status: "pending", pending_since: null, reminded_at: null }, now)).toBe(false);
  });
});

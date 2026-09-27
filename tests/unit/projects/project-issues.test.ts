import { describe, it, expect } from "vitest";
import { projectIssues } from "@/features/projects/domain/project-issues";

const today = new Date(2026, 5, 10); // 2026-06-10, local time (matches domain/attention's dayStart)

const stage = (over: Partial<Parameters<typeof projectIssues>[1][number]> = {}) => ({
  id: "s1",
  name: "Electrics",
  status: "progress" as const,
  end_date: "2026-06-20",
  progress: 40,
  client_note: null,
  is_visible: true,
  tasks: [],
  ...over,
});

const room = (over: Partial<Parameters<typeof projectIssues>[2][number]> = {}) => ({
  id: "r1",
  name: "Kitchen",
  status: "progress" as const,
  client_note: null,
  is_visible: true,
  ...over,
});

const project = (over: Partial<{ schedule_status: "on_schedule" | "at_risk" | "delayed"; budget: number; spent: number }> = {}) => ({
  schedule_status: "on_schedule" as const,
  budget: 10000,
  spent: 4000,
  ...over,
});

describe("projectIssues", () => {
  it("is empty when nothing is blocked, late, over budget or inconsistent", () => {
    expect(projectIssues(project(), [stage()], [room()], today)).toEqual([]);
  });

  it("flags a blocked stage", () => {
    // schedule_status: "at_risk" keeps this isolated from the blockedOnSchedule data-consistency check below.
    const s = stage({ id: "s1", name: "Plumbing", status: "blocked", client_note: "Waiting on parts" });
    expect(projectIssues(project({ schedule_status: "at_risk" }), [s], [], today)).toEqual([
      { kind: "stage_blocked", id: "s1", name: "Plumbing", note: "Waiting on parts" },
    ]);
  });

  it("flags a blocked room", () => {
    const r = room({ id: "r1", name: "Bathroom", status: "blocked", client_note: null });
    expect(projectIssues(project({ schedule_status: "at_risk" }), [], [r], today)).toEqual([
      { kind: "room_blocked", id: "r1", name: "Bathroom", note: null },
    ]);
  });

  it("flags a late stage that isn't blocked", () => {
    const s = stage({ id: "s2", name: "Tiling", status: "progress", end_date: "2026-06-01", progress: 60 });
    expect(projectIssues(project(), [s], [], today)).toEqual([
      { kind: "stage_late", id: "s2", name: "Tiling", daysLate: 9, progress: 60, endDate: "2026-06-01" },
    ]);
  });

  it("does not flag a blocked stage as also late", () => {
    const s = stage({ status: "blocked", end_date: "2026-01-01" });
    const result = projectIssues(project({ schedule_status: "at_risk" }), [s], [], today);
    expect(result).toEqual([{ kind: "stage_blocked", id: s.id, name: s.name, note: null }]);
  });

  it("flags an over-budget project", () => {
    const result = projectIssues(project({ budget: 1000, spent: 1200 }), [stage()], [], today);
    expect(result).toEqual([{ kind: "over_budget", overPct: 20, spent: 1200, budget: 1000 }]);
  });

  it("flags a soft data inconsistency", () => {
    const s = stage({ status: "pending", tasks: [{ name: "Prime", room_id: null, done: true }] });
    const result = projectIssues(project(), [s], [], today);
    expect(result).toEqual([{ kind: "inconsistency", issue: { kind: "stagePendingTasksDone", to: "stages", stage: s.name } }]);
  });

  it("orders issues: blocked, then late, then budget, then data checks", () => {
    const blockedStage = stage({ id: "bs", name: "Blocked stage", status: "blocked" });
    const blockedRoom = room({ id: "br", name: "Blocked room", status: "blocked" });
    const lateStage = stage({ id: "ls", name: "Late stage", status: "progress", end_date: "2026-05-01" });
    const pendingWithDoneTasks = stage({
      id: "ps",
      name: "Pending stage",
      status: "pending",
      end_date: "2026-12-01",
      tasks: [{ name: "Prep", room_id: null, done: true }],
    });

    const result = projectIssues(
      project({ budget: 1000, spent: 1500 }),
      [blockedStage, lateStage, pendingWithDoneTasks],
      [blockedRoom],
      today,
    );

    // Two data-consistency checks fire here (blockedOnSchedule, then stagePendingTasksDone) — both after the budget issue.
    expect(result.map((i) => i.kind)).toEqual([
      "stage_blocked",
      "room_blocked",
      "stage_late",
      "over_budget",
      "inconsistency",
      "inconsistency",
    ]);
  });
});

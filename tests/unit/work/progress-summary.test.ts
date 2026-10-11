import { describe, it, expect } from "vitest";
import { progressSummary } from "@/features/work/domain/progress-summary";
import type { Status } from "@/domain/status";

const today = new Date(2026, 9, 11);
const stage = (name: string, status: Status, progress: number, end_date: string, is_visible = true) => ({
  name,
  status,
  progress,
  end_date,
  is_visible,
});

describe("progressSummary", () => {
  it("handles no stages", () => {
    expect(progressSummary([], today)).toEqual({ stagesDone: 0, stagesTotal: 0, overallProgress: 0, nextDeadline: null, allDone: false });
  });

  it("counts done stages and averages progress", () => {
    const s = progressSummary(
      [stage("A", "done", 100, "2026-10-01"), stage("B", "progress", 50, "2026-10-20"), stage("C", "pending", 0, "2026-11-01")],
      today,
    );
    expect(s.stagesDone).toBe(1);
    expect(s.stagesTotal).toBe(3);
    expect(s.overallProgress).toBe(50);
    expect(s.allDone).toBe(false);
  });

  it("picks the earliest end date among unfinished stages", () => {
    const s = progressSummary(
      [stage("Old", "done", 100, "2026-09-01"), stage("Later", "pending", 0, "2026-12-01"), stage("Next", "progress", 10, "2026-10-20")],
      today,
    );
    expect(s.nextDeadline).toEqual({ name: "Next", endDate: "2026-10-20", lateDays: 0 });
  });

  it("reports days late for an overdue unfinished stage", () => {
    const s = progressSummary([stage("Overdue", "progress", 40, "2026-10-08")], today);
    expect(s.nextDeadline?.lateDays).toBe(3);
  });

  it("is allDone with no next deadline when everything is done", () => {
    const s = progressSummary([stage("A", "done", 100, "2026-10-01"), stage("B", "done", 100, "2026-10-05")], today);
    expect(s.allDone).toBe(true);
    expect(s.nextDeadline).toBeNull();
    expect(s.overallProgress).toBe(100);
  });

  it("ignores hidden stages", () => {
    const s = progressSummary([stage("A", "done", 100, "2026-10-01"), stage("Hidden", "pending", 0, "2026-10-02", false)], today);
    expect(s.stagesTotal).toBe(1);
    expect(s.allDone).toBe(true);
  });
});

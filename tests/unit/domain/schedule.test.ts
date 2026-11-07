import { describe, it, expect } from "vitest";
import { projectHealth, projectOverdueDays, stageOverdueDays } from "@/domain/schedule";
import type { Status } from "@/domain/status";

const today = new Date(2026, 5, 10); // 10 Jun 2026, local time
const active = { status: "active", planned_target_date: "2026-06-10" };
const stage = (name: string, status: Status, is_visible = true) => ({ name, status, is_visible });
const room = (name: string, status: Status, is_visible = true) => ({ name, status, is_visible });

describe("projectOverdueDays", () => {
  it("is not overdue on the planned end day itself", () => {
    expect(projectOverdueDays(active, today)).toBe(0);
  });

  it("counts whole days after the planned end", () => {
    expect(projectOverdueDays({ ...active, planned_target_date: "2026-06-07" }, today)).toBe(3);
  });

  it("is never overdue once completed or archived", () => {
    const late = { planned_target_date: "2026-01-01" };
    expect(projectOverdueDays({ ...late, status: "completed" }, today)).toBe(0);
    expect(projectOverdueDays({ ...late, status: "archived" }, today)).toBe(0);
  });

  it("is not overdue without a plan", () => {
    expect(projectOverdueDays({ status: "active", planned_target_date: null }, today)).toBe(0);
  });
});

describe("stageOverdueDays", () => {
  it("is overdue after its end date while under 100%", () => {
    expect(stageOverdueDays({ end_date: "2026-06-08", status: "progress", progress: 60 }, today)).toBe(2);
  });

  it("is not overdue on the end day, or when done", () => {
    expect(stageOverdueDays({ end_date: "2026-06-10", status: "progress", progress: 60 }, today)).toBe(0);
    expect(stageOverdueDays({ end_date: "2026-06-01", status: "done", progress: 100 }, today)).toBe(0);
  });
});

describe("projectHealth", () => {
  it("is on schedule when nothing is blocked", () => {
    const h = projectHealth(active, [stage("A", "progress"), stage("B", "pending")], [room("Kitchen", "progress")], today);
    expect(h).toEqual({ state: "on_schedule", overdueDays: 0, blockedItems: [] });
  });

  it("is at risk when a stage is blocked while others are in progress", () => {
    const h = projectHealth(active, [stage("A", "blocked"), stage("B", "progress")], [], today);
    expect(h.state).toBe("at_risk");
    expect(h.blockedItems.map((b) => b.name)).toEqual(["A"]);
  });

  it("is blocked when a stage is blocked and every other one is done", () => {
    expect(projectHealth(active, [stage("A", "blocked"), stage("B", "done")], [], today).state).toBe("blocked");
  });

  it("is at risk, not blocked, when only a room is blocked", () => {
    const h = projectHealth(active, [stage("A", "done")], [room("Bathroom", "blocked")], today);
    expect(h.state).toBe("at_risk");
    expect(h.blockedItems.map((b) => b.name)).toEqual(["Bathroom"]);
  });

  it("ignores stages and rooms hidden from the client", () => {
    const h = projectHealth(active, [stage("A", "blocked"), stage("Hidden", "progress", false)], [room("R", "blocked", false)], today);
    expect(h.state).toBe("blocked");
    expect(h.blockedItems.map((b) => b.name)).toEqual(["A"]);
    expect(projectHealth(active, [stage("A", "blocked", false)], [], today).state).toBe("on_schedule");
  });

  it("reports overdue independently of the state", () => {
    const h = projectHealth({ ...active, planned_target_date: "2026-06-05" }, [stage("A", "progress")], [], today);
    expect(h).toMatchObject({ state: "on_schedule", overdueDays: 5 });
  });
});

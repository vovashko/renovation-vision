import { describe, it, expect } from "vitest";
import { findInconsistencies } from "@/domain/consistency";
import type { Status } from "@/domain/status";

type TaskInput = { name: string; room_id?: string | null; done?: boolean };

const stage = (name: string, status: Status, tasks: TaskInput[] = [], is_visible = true) => ({
  name,
  status,
  is_visible,
  tasks: tasks.map((t) => ({ name: t.name, room_id: t.room_id ?? null, done: t.done ?? false })),
});
const room = (id: string, name: string, status: Status, is_visible = true) => ({ id, name, status, is_visible });

const onSchedule = { schedule_status: "on_schedule" as const };

describe("findInconsistencies", () => {
  it("is empty for a consistent project", () => {
    const stages = [stage("Demolition", "done", [{ name: "Strip", done: true }]), stage("Tiling", "pending")];
    expect(findInconsistencies(onSchedule, stages, [room("r1", "Kitchen", "progress")])).toEqual([]);
  });

  it("flags visible blocked work while the project says on schedule", () => {
    const result = findInconsistencies(onSchedule, [stage("Electrics", "blocked")], [room("r1", "Bathroom", "blocked")]);
    expect(result).toEqual([{ kind: "blockedOnSchedule", to: "overview", names: ["Bathroom", "Electrics"], count: 2 }]);
  });

  it("ignores blocked work that is hidden from the client, or when the schedule already says at risk", () => {
    expect(findInconsistencies(onSchedule, [stage("Electrics", "blocked", [], false)], [])).toEqual([]);
    expect(findInconsistencies({ schedule_status: "at_risk" }, [stage("Electrics", "blocked")], [])).toEqual([]);
  });

  it("flags a completed room with an open task", () => {
    const stages = [stage("Tiling", "progress", [{ name: "Grout", room_id: "r1" }])];
    expect(findInconsistencies(onSchedule, stages, [room("r1", "Kitchen", "done")])).toEqual([
      { kind: "roomDoneTaskOpen", to: "plan", room: "Kitchen", task: "Grout" },
    ]);
  });

  it("flags a completed stage with unchecked tasks, with the count", () => {
    const stages = [stage("Plumbing", "done", [{ name: "A" }, { name: "B" }, { name: "C", done: true }])];
    expect(findInconsistencies(onSchedule, stages, [])).toEqual([
      { kind: "stageDoneTasksOpen", to: "stages", stage: "Plumbing", count: 2 },
    ]);
  });

  it("flags a pending stage with checked tasks", () => {
    const stages = [stage("Painting", "pending", [{ name: "Prime", done: true }])];
    expect(findInconsistencies(onSchedule, stages, [])).toEqual([{ kind: "stagePendingTasksDone", to: "stages", stage: "Painting" }]);
  });
});

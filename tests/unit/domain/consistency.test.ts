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

describe("findInconsistencies", () => {
  it("is empty for a consistent project", () => {
    const stages = [stage("Demolition", "done", [{ name: "Strip", done: true }]), stage("Tiling", "pending")];
    expect(findInconsistencies(stages, [room("r1", "Kitchen", "progress")])).toEqual([]);
  });

  it("flags a completed room with an open task", () => {
    const stages = [stage("Tiling", "progress", [{ name: "Grout", room_id: "r1" }])];
    expect(findInconsistencies(stages, [room("r1", "Kitchen", "done")])).toEqual([
      { kind: "roomDoneTaskOpen", to: "plan", room: "Kitchen", task: "Grout" },
    ]);
  });

  it("flags a completed stage with unchecked tasks, with the count", () => {
    const stages = [stage("Plumbing", "done", [{ name: "A" }, { name: "B" }, { name: "C", done: true }])];
    expect(findInconsistencies(stages, [])).toEqual([{ kind: "stageDoneTasksOpen", to: "stages", stage: "Plumbing", count: 2 }]);
  });

  it("flags a pending stage with checked tasks", () => {
    const stages = [stage("Painting", "pending", [{ name: "Prime", done: true }])];
    expect(findInconsistencies(stages, [])).toEqual([{ kind: "stagePendingTasksDone", to: "stages", stage: "Painting" }]);
  });
});

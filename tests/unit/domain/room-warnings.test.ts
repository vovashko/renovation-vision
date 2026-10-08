import { describe, it, expect } from "vitest";
import { isWarningOpen } from "@/domain/room-warnings";
import { taskFlags, taskState } from "@/domain/progress";

describe("isWarningOpen", () => {
  it("a warning without linked materials stays open until a manager removes it", () => {
    expect(isWarningOpen([])).toBe(true);
  });

  it("is open while any linked material is planned or ordered", () => {
    expect(isWarningOpen(["planned"])).toBe(true);
    expect(isWarningOpen(["ordered"])).toBe(true);
    expect(isWarningOpen(["installed", "ordered"])).toBe(true);
    expect(isWarningOpen(["delivered", "planned", "installed"])).toBe(true);
  });

  it("is resolved once every linked material is delivered or installed", () => {
    expect(isWarningOpen(["delivered"])).toBe(false);
    expect(isWarningOpen(["delivered", "installed"])).toBe(false);
  });
});

describe("taskState / taskFlags", () => {
  it("done wins over in_progress", () => {
    expect(taskState({ done: true, in_progress: true })).toBe("done");
    expect(taskState({ done: true, in_progress: false })).toBe("done");
  });

  it("maps the two flags to todo / in_progress / done", () => {
    expect(taskState({ done: false, in_progress: false })).toBe("todo");
    expect(taskState({ done: false, in_progress: true })).toBe("in_progress");
  });

  it("round-trips a chosen state", () => {
    for (const state of ["todo", "in_progress", "done"] as const) {
      expect(taskState(taskFlags(state))).toBe(state);
    }
    expect(taskFlags("in_progress")).toEqual({ done: false, in_progress: true });
  });
});

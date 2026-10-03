import { describe, it, expect } from "vitest";
import { deriveFromTasks, deriveStatus, progressForStatus, statusForProgress, taskProgress } from "@/domain/progress";

describe("deriveStatus", () => {
  it("0% is pending", () => {
    expect(deriveStatus("progress", 0)).toBe("pending");
    expect(deriveStatus("pending", 0)).toBe("pending");
    expect(deriveStatus("done", 0)).toBe("pending");
  });

  it("1% is progress", () => {
    expect(deriveStatus("pending", 1)).toBe("progress");
  });

  it("99% is progress, not done", () => {
    expect(deriveStatus("pending", 99)).toBe("progress");
    expect(deriveStatus("done", 99)).toBe("progress");
  });

  it("100% is done", () => {
    expect(deriveStatus("pending", 100)).toBe("done");
    expect(deriveStatus("progress", 100)).toBe("done");
  });

  it("blocked is kept regardless of progress", () => {
    expect(deriveStatus("blocked", 0)).toBe("blocked");
    expect(deriveStatus("blocked", 1)).toBe("blocked");
    expect(deriveStatus("blocked", 50)).toBe("blocked");
    expect(deriveStatus("blocked", 99)).toBe("blocked");
    // Blocked only stops being blocked when 100% is reached — the database ties done to 100%.
    expect(deriveStatus("blocked", 100)).toBe("done");
  });
});

describe("statusForProgress (progress slider moved)", () => {
  it("moving to 0% clears any non-blocked status back to pending", () => {
    expect(statusForProgress("done", 0)).toBe("pending");
    expect(statusForProgress("progress", 0)).toBe("pending");
  });

  it("moving above 0% and below 100% is always progress, unless blocked", () => {
    expect(statusForProgress("pending", 1)).toBe("progress");
    expect(statusForProgress("pending", 99)).toBe("progress");
    expect(statusForProgress("done", 50)).toBe("progress");
  });

  it("moving to 100% is always done", () => {
    expect(statusForProgress("pending", 100)).toBe("done");
    expect(statusForProgress("blocked", 100)).toBe("done");
  });

  it("blocked stays blocked at any progress short of 100%", () => {
    expect(statusForProgress("blocked", 0)).toBe("blocked");
    expect(statusForProgress("blocked", 1)).toBe("blocked");
    expect(statusForProgress("blocked", 99)).toBe("blocked");
  });
});

describe("progressForStatus (status picked by hand)", () => {
  it("done always sets 100%", () => {
    expect(progressForStatus("done", 40)).toBe(100);
  });

  it("pending always sets 0%", () => {
    expect(progressForStatus("pending", 40)).toBe(0);
  });

  it("progress/blocked keep an in-between progress unchanged", () => {
    expect(progressForStatus("progress", 40)).toBe(40);
    expect(progressForStatus("blocked", 40)).toBe(40);
  });

  it("progress/blocked pull 100% down to 95% so it doesn't silently mean done", () => {
    expect(progressForStatus("progress", 100)).toBe(95);
    expect(progressForStatus("blocked", 100)).toBe(95);
  });

  it("progress/blocked bump 0% up to 5% so it doesn't silently mean pending", () => {
    expect(progressForStatus("progress", 0)).toBe(5);
    expect(progressForStatus("blocked", 0)).toBe(5);
  });
});

describe("taskProgress (checklist completion, mirrors private.stage_task_progress)", () => {
  it("no tasks or none done is 0%", () => {
    expect(taskProgress(0, 0)).toBe(0);
    expect(taskProgress(0, 4)).toBe(0);
  });

  it("rounds done / total", () => {
    expect(taskProgress(1, 2)).toBe(50);
    expect(taskProgress(1, 3)).toBe(33);
    expect(taskProgress(2, 3)).toBe(67);
  });

  it("all done is 100%", () => {
    expect(taskProgress(3, 3)).toBe(100);
  });

  it("never reaches 0% or 100% by rounding alone", () => {
    expect(taskProgress(1, 201)).toBe(1);
    expect(taskProgress(200, 201)).toBe(99);
  });
});

describe("deriveFromTasks (tasks progress mode, mirrors private.stage_derived)", () => {
  it("0 / 50 / 100% give pending / progress / done", () => {
    expect(deriveFromTasks("progress", 0, 2)).toEqual({ progress: 0, status: "pending" });
    expect(deriveFromTasks("pending", 1, 2)).toEqual({ progress: 50, status: "progress" });
    expect(deriveFromTasks("progress", 2, 2)).toEqual({ progress: 100, status: "done" });
  });

  it("a stage without tasks is 0% pending", () => {
    expect(deriveFromTasks("done", 0, 0)).toEqual({ progress: 0, status: "pending" });
  });

  it("never overrides blocked, and caps it at 99%", () => {
    expect(deriveFromTasks("blocked", 1, 2)).toEqual({ progress: 50, status: "blocked" });
    expect(deriveFromTasks("blocked", 2, 2)).toEqual({ progress: 99, status: "blocked" });
  });
});

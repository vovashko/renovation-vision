import { describe, it, expect } from "vitest";
import { roomFormSchema, stageFormSchema, taskAddFormSchema } from "@/features/work/domain/schemas";

const validStage = {
  name: "Demolition",
  progress_mode: "manual" as const,
  status: "progress" as const,
  progress: 40,
  start_date: "2026-01-01",
  end_date: "2026-01-10",
  client_note: "",
  is_visible: true,
};

describe("stageFormSchema", () => {
  it("accepts a consistent stage", () => {
    expect(stageFormSchema.safeParse(validStage).success).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    const result = stageFormSchema.safeParse({ ...validStage, start_date: "2026-01-10", end_date: "2026-01-01" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "end_date");
      expect(issue?.message).toBe("work:stageForm.endBeforeStart");
    }
  });

  it("accepts an end date equal to the start date", () => {
    expect(stageFormSchema.safeParse({ ...validStage, start_date: "2026-01-01", end_date: "2026-01-01" }).success).toBe(true);
  });

  it("rejects status done with progress under 100", () => {
    const result = stageFormSchema.safeParse({ ...validStage, status: "done", progress: 90 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "progress");
      expect(issue?.message).toBe("work:stageForm.statusProgressMismatch");
    }
  });

  it("rejects progress 100 with a status other than done", () => {
    const result = stageFormSchema.safeParse({ ...validStage, status: "progress", progress: 100 });
    expect(result.success).toBe(false);
  });

  it("accepts status done with progress 100", () => {
    expect(stageFormSchema.safeParse({ ...validStage, status: "done", progress: 100 }).success).toBe(true);
  });

  it("requires a non-empty name", () => {
    const result = stageFormSchema.safeParse({ ...validStage, name: "  " });
    expect(result.success).toBe(false);
  });

  it("accepts both progress modes and nothing else", () => {
    expect(stageFormSchema.safeParse({ ...validStage, progress_mode: "tasks" }).success).toBe(true);
    expect(stageFormSchema.safeParse({ ...validStage, progress_mode: "manual" }).success).toBe(true);
    expect(stageFormSchema.safeParse({ ...validStage, progress_mode: "auto" }).success).toBe(false);
    const { progress_mode: _omit, ...withoutMode } = validStage;
    void _omit;
    expect(stageFormSchema.safeParse(withoutMode).success).toBe(false);
  });

  it("accepts the computed values of a tasks-mode stage, including blocked at the 99% cap", () => {
    expect(stageFormSchema.safeParse({ ...validStage, progress_mode: "tasks", status: "blocked", progress: 99 }).success).toBe(true);
    expect(stageFormSchema.safeParse({ ...validStage, progress_mode: "tasks", status: "pending", progress: 0 }).success).toBe(true);
  });

  it("keeps the done = 100% rule in tasks mode too", () => {
    expect(stageFormSchema.safeParse({ ...validStage, progress_mode: "tasks", status: "blocked", progress: 100 }).success).toBe(false);
  });
});

const validRoom = {
  name: "Kitchen",
  status: "pending" as const,
  progress: 0,
  client_note: "",
  is_visible: true,
  w: 4,
  h: 3,
};

describe("roomFormSchema", () => {
  it("accepts a consistent room", () => {
    expect(roomFormSchema.safeParse(validRoom).success).toBe(true);
  });

  it("rejects status done with progress under 100", () => {
    const result = roomFormSchema.safeParse({ ...validRoom, status: "done", progress: 50 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "progress");
      expect(issue?.message).toBe("work:roomForm.statusProgressMismatch");
    }
  });

  it("accepts status done with progress 100", () => {
    expect(roomFormSchema.safeParse({ ...validRoom, status: "done", progress: 100 }).success).toBe(true);
  });

  it("rejects implausible room dimensions (metres)", () => {
    expect(roomFormSchema.safeParse({ ...validRoom, w: 0.1 }).success).toBe(false);
    expect(roomFormSchema.safeParse({ ...validRoom, h: 150 }).success).toBe(false);
    expect(roomFormSchema.safeParse({ ...validRoom, w: Number.NaN }).success).toBe(false);
  });
});

describe("taskAddFormSchema", () => {
  it("accepts a name with no room", () => {
    expect(taskAddFormSchema.safeParse({ name: "Tile the floor", room_id: "" }).success).toBe(true);
  });

  it("accepts a name with a room", () => {
    expect(taskAddFormSchema.safeParse({ name: "Tile the floor", room_id: "kitchen-id" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(taskAddFormSchema.safeParse({ name: "   ", room_id: "" }).success).toBe(false);
  });
});

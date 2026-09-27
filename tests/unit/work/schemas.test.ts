import { describe, it, expect } from "vitest";
import { roomFormSchema, stageFormSchema, taskAddFormSchema } from "@/features/work/domain/schemas";

const validStage = {
  name: "Demolition",
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
});

const validRoom = {
  name: "Kitchen",
  status: "pending" as const,
  progress: 0,
  client_note: "",
  is_visible: true,
  x: 20,
  y: 20,
  w: 160,
  h: 120,
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

  it("rejects geometry outside the 600x420 plan grid", () => {
    expect(roomFormSchema.safeParse({ ...validRoom, x: 700 }).success).toBe(false);
    expect(roomFormSchema.safeParse({ ...validRoom, w: 5 }).success).toBe(false);
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

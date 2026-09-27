import { describe, it, expect } from "vitest";
import { newProjectSchema, projectEditSchema } from "@/features/projects/domain/schemas";

describe("newProjectSchema", () => {
  const base = { name: "Kitchen remodel", address: "1 Main St", client_name: "Sarah", start_date: "", target_date: "", budget: "1000" };

  it("accepts a minimal valid project and coerces the budget to a number", () => {
    const result = newProjectSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.budget).toBe(1000);
  });

  it("requires a name", () => {
    const result = newProjectSchema.safeParse({ ...base, name: "  " });
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0].message).toBe("common:form.required");
  });

  it("rejects a negative budget", () => {
    const result = newProjectSchema.safeParse({ ...base, budget: "-5" });
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.issues[0].message).toBe("common:form.invalid");
  });
});

describe("projectEditSchema", () => {
  const base = {
    name: "Kitchen remodel",
    address: "1 Main St",
    client_name: "Sarah",
    start_date: "2026-01-01",
    target_date: "2026-06-01",
    budget: 5000,
    schedule_status: "on_schedule",
    schedule_note: "",
  };

  it("accepts a valid edit", () => {
    expect(projectEditSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an unknown schedule status", () => {
    const result = projectEditSchema.safeParse({ ...base, schedule_status: "ahead" });
    expect(result.success).toBe(false);
  });

  it("accepts every real schedule status", () => {
    for (const status of ["on_schedule", "at_risk", "delayed"]) {
      expect(projectEditSchema.safeParse({ ...base, schedule_status: status }).success).toBe(true);
    }
  });
});

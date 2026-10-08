import { describe, it, expect } from "vitest";
import { newProjectSchema, projectEditSchema } from "@/features/projects/domain/schemas";

const address = {
  address_line: "ul. Długa 5/3",
  postal_code: "00-238",
  city: "Warszawa",
  country: "PL",
  currency: "PLN",
  status: "active",
};

const issue = (result: { success: boolean; error?: { issues: { message: string; path: (string | number)[] }[] } }) =>
  result.success ? undefined : result.error?.issues[0];

describe("newProjectSchema", () => {
  const base = { name: "Kitchen remodel", ...address, client_name: "Sarah", start_date: "", target_date: "", budget: "1000" };

  it("accepts a minimal valid project and coerces the budget to a number", () => {
    const result = newProjectSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.budget).toBe(1000);
  });

  it("accepts an empty address and client name", () => {
    const result = newProjectSchema.safeParse({ ...base, address_line: "", postal_code: "", city: "", client_name: "" });
    expect(result.success).toBe(true);
  });

  it("requires a name", () => {
    const result = newProjectSchema.safeParse({ ...base, name: "  " });
    expect(issue(result)?.message).toBe("common:form.required");
  });

  it("rejects a negative budget", () => {
    const result = newProjectSchema.safeParse({ ...base, budget: "-5" });
    expect(issue(result)?.message).toBe("common:form.invalid");
  });

  it("checks the Polish postal code format, on the postal code field", () => {
    const result = newProjectSchema.safeParse({ ...base, postal_code: "00238" });
    expect(issue(result)).toMatchObject({ message: "projects:form.postalCodePl", path: ["postal_code"] });
    expect(newProjectSchema.safeParse({ ...base, country: "DE", postal_code: "10115" }).success).toBe(true);
  });

  it("accepts PLN and EUR and rejects malformed currency codes (same rule as the database)", () => {
    for (const currency of ["PLN", "EUR"]) expect(newProjectSchema.safeParse({ ...base, currency }).success).toBe(true);
    for (const currency of ["pln", "PL", "EURO", ""]) {
      expect(issue(newProjectSchema.safeParse({ ...base, currency }))?.message).toBe("common:form.invalid");
    }
  });

  it("rejects a malformed country code", () => {
    expect(newProjectSchema.safeParse({ ...base, country: "pl" }).success).toBe(false);
    expect(newProjectSchema.safeParse({ ...base, country: "POL" }).success).toBe(false);
  });

  it("accepts every lifecycle status and rejects others", () => {
    for (const status of ["planning", "active", "on_hold", "completed", "archived"]) {
      expect(newProjectSchema.safeParse({ ...base, status }).success).toBe(true);
    }
    expect(newProjectSchema.safeParse({ ...base, status: "paused" }).success).toBe(false);
  });
});

describe("projectEditSchema", () => {
  const base = {
    name: "Kitchen remodel",
    ...address,
    start_date: "2026-01-01",
    target_date: "2026-06-01",
    budget: 5000,
    planned_target_date: "2026-05-01",
    planned_budget: 4500,
    schedule_status: "on_schedule",
    schedule_note: "",
  };

  it("accepts a valid edit", () => {
    expect(projectEditSchema.safeParse(base).success).toBe(true);
  });

  it("carries the planned baseline and rejects a negative planned budget", () => {
    const result = projectEditSchema.safeParse(base);
    expect(result.success && result.data.planned_budget).toBe(4500);
    expect(projectEditSchema.safeParse({ ...base, planned_budget: -1 }).success).toBe(false);
  });

  it("no longer carries the client name (it lives on the client card)", () => {
    const result = projectEditSchema.safeParse({ ...base, client_name: "Sarah" });
    expect(result.success && "client_name" in result.data).toBe(false);
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

  it("applies the same postal code and currency rules", () => {
    expect(projectEditSchema.safeParse({ ...base, postal_code: "1234" }).success).toBe(false);
    expect(projectEditSchema.safeParse({ ...base, currency: "eur" }).success).toBe(false);
    expect(projectEditSchema.safeParse({ ...base, currency: "EUR" }).success).toBe(true);
  });
});

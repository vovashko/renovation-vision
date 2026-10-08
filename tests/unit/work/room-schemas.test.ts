import { describe, it, expect } from "vitest";
import { materialFormSchema, roomTaskFormSchema, warningFormSchema } from "@/features/work/domain/schemas";

const validMaterial = {
  name: "Quartz worktop",
  quantity: 1,
  unit: "pcs",
  status: "planned" as const,
  order_by_date: "2026-05-12",
  delivery_date: "",
};

describe("materialFormSchema", () => {
  it("accepts a material with one date set", () => {
    expect(materialFormSchema.safeParse(validMaterial).success).toBe(true);
  });

  it("requires a name and a unit", () => {
    expect(materialFormSchema.safeParse({ ...validMaterial, name: "  " }).success).toBe(false);
    expect(materialFormSchema.safeParse({ ...validMaterial, unit: "" }).success).toBe(false);
  });

  it("needs a positive quantity (the database checks quantity > 0)", () => {
    expect(materialFormSchema.safeParse({ ...validMaterial, quantity: 0 }).success).toBe(false);
    expect(materialFormSchema.safeParse({ ...validMaterial, quantity: Number.NaN }).success).toBe(false);
    expect(materialFormSchema.safeParse({ ...validMaterial, quantity: 2.5 }).success).toBe(true);
  });

  it("limits the unit to the database's 16 characters", () => {
    expect(materialFormSchema.safeParse({ ...validMaterial, unit: "x".repeat(17) }).success).toBe(false);
  });

  it("accepts only the four material statuses", () => {
    for (const status of ["planned", "ordered", "delivered", "installed"]) {
      expect(materialFormSchema.safeParse({ ...validMaterial, status }).success).toBe(true);
    }
    expect(materialFormSchema.safeParse({ ...validMaterial, status: "lost" }).success).toBe(false);
  });

  it("takes dates as YYYY-MM-DD or empty", () => {
    expect(materialFormSchema.safeParse({ ...validMaterial, delivery_date: "2026-06-01" }).success).toBe(true);
    expect(materialFormSchema.safeParse({ ...validMaterial, delivery_date: "01/06/2026" }).success).toBe(false);
  });
});

describe("warningFormSchema", () => {
  it("needs text; linked materials are optional", () => {
    expect(warningFormSchema.safeParse({ text: "Worktop not ordered", material_ids: [] }).success).toBe(true);
    expect(warningFormSchema.safeParse({ text: "   ", material_ids: [] }).success).toBe(false);
  });

  it("caps the text at the database's 2000 characters", () => {
    expect(warningFormSchema.safeParse({ text: "x".repeat(2001), material_ids: [] }).success).toBe(false);
  });
});

describe("roomTaskFormSchema", () => {
  it("needs a name; the stage is optional", () => {
    expect(roomTaskFormSchema.safeParse({ name: "Paint walls", stage_id: "" }).success).toBe(true);
    expect(roomTaskFormSchema.safeParse({ name: "", stage_id: "s1" }).success).toBe(false);
  });
});

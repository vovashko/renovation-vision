import { describe, it, expect } from "vitest";
import { expenseSchema } from "@/features/budget/domain/schemas";

const base = {
  description: "Oak planks",
  spent_on: "2026-04-19",
  category: "Materials" as const,
  stage_id: "",
  vendor: "",
  vendor_notes: "",
  receiptFile: null,
};

describe("expenseSchema", () => {
  it("accepts a plain decimal amount", () => {
    const result = expenseSchema.safeParse({ ...base, amount: "12.50" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(12.5);
  });

  it("accepts a Polish decimal comma", () => {
    const result = expenseSchema.safeParse({ ...base, amount: "1234,56" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(1234.56);
  });

  it("accepts a whole number amount", () => {
    const result = expenseSchema.safeParse({ ...base, amount: "100" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(100);
  });

  it("rejects a zero amount", () => {
    const result = expenseSchema.safeParse({ ...base, amount: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = expenseSchema.safeParse({ ...base, amount: "-5" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty amount", () => {
    const result = expenseSchema.safeParse({ ...base, amount: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric amount", () => {
    const result = expenseSchema.safeParse({ ...base, amount: "abc" });
    expect(result.success).toBe(false);
  });

  it("requires a date", () => {
    const result = expenseSchema.safeParse({ ...base, amount: "10", spent_on: "" });
    expect(result.success).toBe(false);
  });

  it("requires a description", () => {
    const result = expenseSchema.safeParse({ ...base, amount: "10", description: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects a category outside the fixed list", () => {
    const result = expenseSchema.safeParse({ ...base, amount: "10", category: "Snacks" });
    expect(result.success).toBe(false);
  });

  it("allows an optional stage, vendor and vendor notes to be blank", () => {
    const result = expenseSchema.safeParse({ ...base, amount: "10" });
    expect(result.success).toBe(true);
  });
});

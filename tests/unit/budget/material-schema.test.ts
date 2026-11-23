import { describe, expect, it } from "vitest";
import { parseMoney } from "@/domain/money";
import { canCreateExpense, deliveredExpenseAmount, materialTotal } from "@/domain/materials";
import { markDeliveredSchema, materialFormSchema, stageFormSchema } from "@/features/work/domain/schemas";

const material = {
  name: "Oak planks",
  quantity: 68,
  unit: "m2",
  status: "planned" as const,
  order_by_date: "",
  delivery_date: "",
};

describe("materialFormSchema unit price", () => {
  it("accepts the number MoneyInput emits from typed text", () => {
    const unit_price = parseMoney("94,85", "pl");
    expect(unit_price).toBe(94.85);
    expect(materialFormSchema.safeParse({ ...material, unit_price }).success).toBe(true);
    expect(parseMoney("1 000,50", "pl")).toBe(1000.5);
    expect(parseMoney("1,000.50", "en")).toBe(1000.5);
  });

  it("accepts an empty price (the saved one is left alone) and zero", () => {
    expect(materialFormSchema.safeParse({ ...material, unit_price: null }).success).toBe(true);
    expect(materialFormSchema.safeParse(material).success).toBe(true);
    expect(materialFormSchema.safeParse({ ...material, unit_price: 0 }).success).toBe(true);
  });

  it("rejects a negative or absurd price, and junk parses to nothing", () => {
    expect(materialFormSchema.safeParse({ ...material, unit_price: -1 }).success).toBe(false);
    expect(materialFormSchema.safeParse({ ...material, unit_price: 1e11 }).success).toBe(false);
    expect(parseMoney("abc", "pl")).toBeNull();
    expect(parseMoney("-5", "pl")).toBeNull();
  });
});

describe("stage planned cost", () => {
  const stage = {
    name: "Floor",
    progress_mode: "manual" as const,
    status: "pending" as const,
    progress: 0,
    start_date: "2026-05-01",
    end_date: "2026-05-10",
    client_note: "",
    is_visible: true,
  };

  it("is optional and never negative", () => {
    expect(stageFormSchema.safeParse(stage).success).toBe(true);
    expect(stageFormSchema.safeParse({ ...stage, planned_cost: null }).success).toBe(true);
    expect(stageFormSchema.safeParse({ ...stage, planned_cost: 12000 }).success).toBe(true);
    expect(stageFormSchema.safeParse({ ...stage, planned_cost: -5 }).success).toBe(false);
  });
});

describe("delivered → expense amount", () => {
  it("is quantity × unit price, rounded to cents", () => {
    expect(materialTotal({ quantity: 68, unit_price: 94.85 })).toBe(6449.8);
    expect(deliveredExpenseAmount({ quantity: 9.5, unit_price: 189 })).toBe(1795.5);
    expect(deliveredExpenseAmount({ quantity: 0.333, unit_price: 10.01 })).toBe(3.33);
  });

  it("is null when there is nothing to charge, so the field starts empty", () => {
    expect(deliveredExpenseAmount({ quantity: 5, unit_price: 0 })).toBeNull();
  });

  it("the expense form needs a positive amount and a date", () => {
    expect(markDeliveredSchema.safeParse({ amount: 6449.8, spent_on: "2026-05-07" }).success).toBe(true);
    expect(markDeliveredSchema.safeParse({ amount: null, spent_on: "2026-05-07" }).success).toBe(false);
    expect(markDeliveredSchema.safeParse({ amount: 0, spent_on: "2026-05-07" }).success).toBe(false);
    expect(markDeliveredSchema.safeParse({ amount: 10, spent_on: "" }).success).toBe(false);
  });

  it("a material that already has an expense can't get a second one", () => {
    expect(canCreateExpense({ expense_id: null })).toBe(true);
    expect(canCreateExpense({ expense_id: "e1" })).toBe(false);
  });
});

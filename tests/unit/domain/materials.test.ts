import { describe, it, expect } from "vitest";
import { materialDateInfo, materialStatuses, materialTone } from "@/domain/materials";

describe("materialTone", () => {
  it("planned (not ordered) is red", () => {
    expect(materialTone("planned")).toBe("red");
  });

  it("ordered is orange", () => {
    expect(materialTone("ordered")).toBe("orange");
  });

  it("delivered and installed are green", () => {
    expect(materialTone("delivered")).toBe("green");
    expect(materialTone("installed")).toBe("green");
  });

  it("covers every status", () => {
    expect(materialStatuses.map(materialTone)).toEqual(["red", "orange", "green", "green"]);
  });
});

describe("materialDateInfo", () => {
  const dates = { order_by_date: "2026-05-12", delivery_date: "2026-05-20" };

  it("a not-ordered material shows the latest order date", () => {
    expect(materialDateInfo({ status: "planned", ...dates })).toEqual({ kind: "orderBy", date: "2026-05-12" });
  });

  it("an ordered material shows the expected delivery", () => {
    expect(materialDateInfo({ status: "ordered", ...dates })).toEqual({ kind: "delivery", date: "2026-05-20" });
  });

  it("delivered and installed materials show when they arrived", () => {
    expect(materialDateInfo({ status: "delivered", ...dates })).toEqual({ kind: "delivered", date: "2026-05-20" });
    expect(materialDateInfo({ status: "installed", ...dates })).toEqual({ kind: "delivered", date: "2026-05-20" });
  });

  it("shows nothing when the date that matters for the status is unknown", () => {
    expect(materialDateInfo({ status: "planned", order_by_date: null, delivery_date: "2026-05-20" })).toBeNull();
    expect(materialDateInfo({ status: "ordered", order_by_date: "2026-05-12", delivery_date: null })).toBeNull();
    expect(materialDateInfo({ status: "delivered", order_by_date: null, delivery_date: null })).toBeNull();
  });
});

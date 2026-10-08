import { describe, it, expect } from "vitest";
import { Route as DesignRoute } from "@/routes/project/design";

const validateDesign = DesignRoute.options.validateSearch as (search: Record<string, unknown>) => { view: string; room?: string };

describe("design route search params", () => {
  it("defaults to the renders view", () => {
    expect(validateDesign({})).toEqual({ view: "renders", room: undefined });
  });

  it("accepts the plan view", () => {
    expect(validateDesign({ view: "plan" })).toEqual({ view: "plan", room: undefined });
  });

  it("falls back to renders for an unknown view value", () => {
    expect(validateDesign({ view: "bogus" })).toEqual({ view: "renders", room: undefined });
  });

  it("keeps a string room param", () => {
    expect(validateDesign({ view: "plan", room: "kitchen" })).toEqual({ view: "plan", room: "kitchen" });
  });

  it("drops a non-string room param", () => {
    expect(validateDesign({ room: 42 })).toEqual({ view: "renders", room: undefined });
  });
});

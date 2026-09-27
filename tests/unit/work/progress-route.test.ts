import { describe, it, expect } from "vitest";
import { Route as ProgressRoute } from "@/routes/project/progress";
import { Route as StagesRoute } from "@/routes/project/stages";
import { Route as PlanRoute } from "@/routes/project/plan";

// `validateSearch` and `beforeLoad` are plain functions on the route options — call them directly
// rather than booting the router, matching this file's narrow, fast unit-test scope.
const validateProgress = ProgressRoute.options.validateSearch as (search: Record<string, unknown>) => { view: string; room?: string };
const redirectFrom = (route: unknown, opts: unknown) => {
  const beforeLoad = (route as { options: { beforeLoad?: (opts: unknown) => unknown } }).options.beforeLoad;
  try {
    beforeLoad?.(opts);
    return null;
  } catch (thrown) {
    return thrown as { options: { to: string; params: unknown; search?: unknown; hash?: unknown } };
  }
};

describe("progress route search params", () => {
  it("defaults to the timeline view", () => {
    expect(validateProgress({})).toEqual({ view: "timeline", room: undefined });
  });

  it("accepts the plan view", () => {
    expect(validateProgress({ view: "plan" })).toEqual({ view: "plan", room: undefined });
  });

  it("falls back to timeline for an unknown view value", () => {
    expect(validateProgress({ view: "bogus" })).toEqual({ view: "timeline", room: undefined });
  });

  it("keeps a string room param", () => {
    expect(validateProgress({ view: "plan", room: "kitchen" })).toEqual({ view: "plan", room: "kitchen" });
  });

  it("drops a non-string room param", () => {
    expect(validateProgress({ room: 42 })).toEqual({ view: "timeline", room: undefined });
  });
});

describe("stages -> progress redirect", () => {
  it("redirects to progress?view=timeline, keeping the hash", () => {
    const redirect = redirectFrom(StagesRoute, { params: { projectId: "p1" }, location: { hash: "stage-1" } });
    expect(redirect?.options.to).toBe("/projects/$projectId/progress");
    expect(redirect?.options.params).toEqual({ projectId: "p1" });
    expect(redirect?.options.search).toEqual({ view: "timeline" });
    expect(redirect?.options.hash).toBe("stage-1");
  });

  it("omits the hash when there isn't one", () => {
    const redirect = redirectFrom(StagesRoute, { params: { projectId: "p1" }, location: { hash: "" } });
    expect(redirect?.options.hash).toBeUndefined();
  });
});

describe("plan -> progress redirect", () => {
  it("redirects to progress?view=plan, keeping the room param", () => {
    const redirect = redirectFrom(PlanRoute, { params: { projectId: "p1" }, search: { room: "kitchen" } });
    expect(redirect?.options.to).toBe("/projects/$projectId/progress");
    expect(redirect?.options.params).toEqual({ projectId: "p1" });
    expect(redirect?.options.search).toEqual({ view: "plan", room: "kitchen" });
  });

  it("redirects without a room param when none was given", () => {
    const redirect = redirectFrom(PlanRoute, { params: { projectId: "p1" }, search: {} });
    expect(redirect?.options.search).toEqual({ view: "plan", room: undefined });
  });
});

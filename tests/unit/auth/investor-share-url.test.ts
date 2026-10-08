import { describe, expect, it } from "vitest";
import { investorShareUrl, safeRedirectTarget } from "@/features/auth/domain/guards";

describe("investorShareUrl", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("returns the absolute URL of a client-accessible section", () => {
    expect(investorShareUrl("https://app.test", `/projects/${id}/photos`, "")).toBe(`https://app.test/projects/${id}/photos`);
    expect(investorShareUrl("https://app.test", `/projects/${id}/chat`, "")).toBe(`https://app.test/projects/${id}/chat`);
  });
  it("keeps the query string", () => {
    expect(investorShareUrl("https://app.test", `/projects/${id}/progress`, "?view=plan")).toBe(
      `https://app.test/projects/${id}/progress?view=plan`,
    );
  });
  it("works for the overview", () => {
    expect(investorShareUrl("https://app.test", `/projects/${id}`, "")).toBe(`https://app.test/projects/${id}`);
  });
  it("returns null on manager-only sections", () => {
    for (const s of ["budget", "updates", "knowledge", "team"]) {
      expect(investorShareUrl("https://app.test", `/projects/${id}/${s}`, "")).toBeNull();
    }
  });
  it("round-trips through safeRedirectTarget (login redirect) keeping ?view=plan, and rejects //evil", () => {
    const target = `/projects/${id}/progress?view=plan`;
    expect(safeRedirectTarget(target)).toBe(target);
    expect(safeRedirectTarget("//evil")).toBe("/");
  });
});

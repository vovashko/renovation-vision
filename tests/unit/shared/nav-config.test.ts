import { describe, it, expect } from "vitest";
import en from "@/i18n/common/en.json";
import { managerOnlySections, navItemsFor, projectNav, projectPath, projectRoute } from "@/shared/ui/nav-config";

describe("nav-config", () => {
  it("keeps the current sections, in rail order", () => {
    expect(projectNav.map((i) => i.key)).toEqual([
      "overview",
      "stages",
      "plan",
      "photos",
      "design",
      "budget",
      "chat",
      "updates",
      "knowledge",
      "team",
    ]);
  });

  it("every label is a common:nav key that exists", () => {
    for (const item of projectNav) {
      const key = item.labelKey.replace("common:nav.", "") as keyof typeof en.nav;
      expect(en.nav[key], item.labelKey).toBeTruthy();
    }
  });

  it("a client sees only the client sections; a manager sees everything", () => {
    expect(navItemsFor("client").map((i) => i.key)).toEqual(["overview", "stages", "plan", "photos", "design", "chat"]);
    expect(navItemsFor("manager")).toHaveLength(projectNav.length);
    expect(managerOnlySections).toEqual(["budget", "updates", "knowledge", "team"]);
  });

  it("puts four client sections in the phone tab bar and the rest under More", () => {
    expect(navItemsFor("client", "tab").map((i) => i.section)).toEqual(["", "stages", "photos", "chat"]);
    expect(navItemsFor("client", "more").map((i) => i.section)).toEqual(["plan", "design"]);
  });

  it("builds section URLs and router targets", () => {
    expect(projectPath("p1", "")).toBe("/projects/p1");
    expect(projectPath("p1", "budget")).toBe("/projects/p1/budget");
    expect(projectRoute("")).toBe("/projects/$projectId");
    expect(projectRoute("chat")).toBe("/projects/$projectId/chat");
  });
});

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import en from "@/i18n/common/en.json";
import pl from "@/i18n/common/pl.json";
import workEn from "@/features/work/i18n/en.json";
import workPl from "@/features/work/i18n/pl.json";
import { managerOnlySections, navItemsFor, projectNav, projectPath, projectRoute } from "@/shared/ui/nav-config";

const routesConfigSource = fs.readFileSync(path.resolve(__dirname, "../../../src/routes.config.ts"), "utf8");

/** Resolve a `labelKey` against the right namespace's JSON (mirrors what `t(item.labelKey)` does). */
function labelExists(labelKey: string, common: typeof en, work: typeof workEn) {
  if (labelKey.startsWith("work:nav.")) {
    const key = labelKey.replace("work:nav.", "") as keyof typeof work.nav;
    return Boolean(work.nav[key]);
  }
  const key = labelKey.replace("common:nav.", "") as keyof typeof common.nav;
  return Boolean(common.nav[key]);
}

describe("nav-config", () => {
  it("keeps the current sections, in rail order", () => {
    // Stages and the floor plan merged into one Progress page with a timeline/plan tab (T13).
    expect(projectNav.map((i) => i.key)).toEqual([
      "overview",
      "progress",
      "photos",
      "design",
      "documents",
      "budget",
      "chat",
      "updates",
      "knowledge",
      "team",
    ]);
  });

  it("every label is a common:nav or work:nav key that exists in both en and pl", () => {
    for (const item of projectNav) {
      expect(labelExists(item.labelKey, en, workEn), `${item.labelKey} (en)`).toBe(true);
      expect(labelExists(item.labelKey, pl, workPl), `${item.labelKey} (pl)`).toBe(true);
    }
  });

  it("every section maps to a registered route in routes.config.ts", () => {
    for (const item of projectNav) {
      if (item.section === "") {
        expect(routesConfigSource).toContain('index("project/overview.tsx")');
        continue;
      }
      expect(routesConfigSource, item.section).toMatch(new RegExp(`route\\("${item.section}",`));
    }
  });

  it("a client sees only the client sections; a manager sees everything", () => {
    expect(navItemsFor("client").map((i) => i.key)).toEqual(["overview", "progress", "photos", "design", "documents", "chat"]);
    expect(navItemsFor("manager")).toHaveLength(projectNav.length);
    expect(managerOnlySections).toEqual(["budget", "updates", "knowledge", "team"]);
  });

  it("puts four client sections in the phone tab bar and the rest under More", () => {
    expect(navItemsFor("client", "tab").map((i) => i.section)).toEqual(["", "progress", "photos", "chat"]);
    expect(navItemsFor("client", "more").map((i) => i.section)).toEqual(["design", "documents"]);
  });

  it("puts the same four tabs in the phone tab bar for a manager, with the rest under More", () => {
    expect(navItemsFor("manager", "tab").map((i) => i.section)).toEqual(["", "progress", "photos", "chat"]);
    expect(navItemsFor("manager", "more").map((i) => i.section)).toEqual(["design", "documents", "budget", "updates", "knowledge", "team"]);
  });

  it("builds section URLs and router targets", () => {
    expect(projectPath("p1", "")).toBe("/projects/p1");
    expect(projectPath("p1", "budget")).toBe("/projects/p1/budget");
    expect(projectRoute("")).toBe("/projects/$projectId");
    expect(projectRoute("chat")).toBe("/projects/$projectId/chat");
  });
});

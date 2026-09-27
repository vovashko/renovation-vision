import { describe, it, expect } from "vitest";
import { projectNav, managerOnlySections } from "@/lib/nav";

/** What a persona actually sees in the rail, mirroring the `isManager || !managerOnly` filter in app-sidebar.tsx and mobile-nav.tsx. */
function itemsFor(role: "manager" | "client") {
  return projectNav.filter((item) => role === "manager" || !item.managerOnly);
}

describe("projectNav items", () => {
  it("every item has a non-empty Material Symbols icon name", () => {
    for (const item of projectNav) {
      expect(typeof item.icon).toBe("string");
      expect(item.icon.trim().length).toBeGreaterThan(0);
    }
  });

  it("a manager sees every section, including manager-only ones", () => {
    const manager = itemsFor("manager");
    expect(manager).toHaveLength(projectNav.length);
    for (const section of managerOnlySections) {
      expect(manager.some((item) => item.section === section)).toBe(true);
    }
  });

  it("a client never sees a manager-only section", () => {
    const client = itemsFor("client");
    expect(client.length).toBeLessThan(projectNav.length);
    for (const section of managerOnlySections) {
      expect(client.some((item) => item.section === section)).toBe(false);
    }
    for (const item of client) {
      expect(item.managerOnly).not.toBe(true);
    }
  });

  it("managerOnlySections matches the items flagged managerOnly", () => {
    const flagged = projectNav.filter((i) => i.managerOnly).map((i) => i.section);
    expect(managerOnlySections).toEqual(flagged);
  });
});

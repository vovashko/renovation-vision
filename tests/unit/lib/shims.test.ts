import { describe, it, expect } from "vitest";
import { statusLabel, statuses } from "@/lib/status";
import { dateTime, longDate, money, scheduleLabel, shortDate, timeLabel } from "@/lib/format";
import { lateLabel } from "@/lib/attention";
import { findInconsistencies } from "@/lib/consistency";
import { projectNav } from "@/lib/nav";
import type { ProjectSummary } from "@/lib/database.types";

// The deprecated src/lib shims must keep today's English output until each feature moves to
// @/domain + i18n (W2c) and T17 deletes them.

describe("deprecated src/lib shims", () => {
  it("status and schedule labels are the English common strings", () => {
    expect(statuses).toEqual(["done", "progress", "pending", "blocked"]);
    expect(statusLabel).toEqual({ done: "Completed", progress: "In progress", pending: "Pending", blocked: "Blocked" });
    expect(scheduleLabel).toEqual({ on_schedule: "On schedule", at_risk: "At risk", delayed: "Delayed" });
  });

  it("format helpers keep the en-US output", () => {
    const at = new Date(2026, 2, 2, 14, 30).toISOString();
    expect(shortDate("2026-03-02")).toBe("Mar 02");
    expect(longDate("2026-03-02")).toBe("Mar 02, 2026");
    expect(shortDate(null)).toBe("—");
    expect(money(12345.4)).toBe("$12,345");
    expect(dateTime(at).replace(/\u202f/g, " ")).toBe("Mar 02, 02:30 PM");
    expect(timeLabel(at).replace(/\u202f/g, " ")).toBe("02:30 PM");
    expect(lateLabel(1)).toBe("1 day late");
    expect(lateLabel(3)).toBe("3 days late");
  });

  it("nav items keep their English titles and managerOnly flags", () => {
    // Stages and the floor plan merged into one Progress page (T13); its title comes from the
    // work namespace since there's no common:nav key for it.
    expect(projectNav.map((i) => i.title)).toEqual([
      "Overview",
      "Progress",
      "Photos",
      "Design",
      "Budget",
      "Chat",
      "Updates",
      "AI knowledge",
      "Team",
    ]);
    expect(projectNav.filter((i) => i.managerOnly).map((i) => i.section)).toEqual(["budget", "updates", "knowledge", "team"]);
  });

  it("findInconsistencies still returns English text", () => {
    const project = { schedule_status: "on_schedule" } as ProjectSummary;
    const stage = {
      name: "Plumbing",
      status: "done",
      is_visible: true,
      tasks: [{ name: "Test", room_id: null, done: false }],
    } as unknown as Parameters<typeof findInconsistencies>[1][number];
    expect(findInconsistencies(project, [stage], [])).toEqual([{ text: "Plumbing is Completed but 1 task is unchecked.", to: "stages" }]);
  });
});

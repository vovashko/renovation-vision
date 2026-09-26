import { describe, it, expect } from "vitest";
import { dayLabel } from "@/lib/chat-format";

describe("dayLabel", () => {
  const today = new Date(2026, 3, 20, 15, 0, 0); // Apr 20, 2026, 15:00 local

  it("labels a message from today as 'Today'", () => {
    expect(dayLabel(new Date(2026, 3, 20, 9, 30).toISOString(), today)).toBe("Today");
  });

  it("labels a message from the day before as 'Yesterday'", () => {
    expect(dayLabel(new Date(2026, 3, 19, 23, 59).toISOString(), today)).toBe("Yesterday");
  });

  it("labels an older date with the weekday and short date", () => {
    // Apr 10, 2026 is a Friday.
    expect(dayLabel(new Date(2026, 3, 10, 12, 0).toISOString(), today)).toBe("Fri, Apr 10");
  });

  it("treats a message just after midnight as today, not yesterday", () => {
    const justAfterMidnight = new Date(2026, 3, 20, 0, 5);
    expect(dayLabel(justAfterMidnight.toISOString(), today)).toBe("Today");
  });

  it("treats a message just before midnight (the day before) as yesterday", () => {
    const justBeforeMidnight = new Date(2026, 3, 19, 23, 55);
    expect(dayLabel(justBeforeMidnight.toISOString(), today)).toBe("Yesterday");
  });

  it("defaults `today` to the current date when not passed", () => {
    const now = new Date();
    expect(dayLabel(now.toISOString())).toBe("Today");
  });
});

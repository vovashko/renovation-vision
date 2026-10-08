import { describe, it, expect } from "vitest";
import { NO_DATE, dayOffset, formatDate, formatDayLabel, parseDate, scheduleDeviationDays, toDate } from "@/domain/dates";

const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

// Built from local parts, so the expectations hold in any timezone.
const afternoon = new Date(2026, 2, 2, 14, 30); // Mon, Mar 2 2026, 14:30 local

describe("parseDate", () => {
  it("parses 'YYYY-MM-DD' as a local date with no timezone shift", () => {
    const d = parseDate("2026-04-20");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // 0-indexed: April
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(0);
  });

  it("keeps the first and last day of a month on that day", () => {
    expect(parseDate("2026-01-01").getDate()).toBe(1);
    expect(parseDate("2026-12-31").getMonth()).toBe(11);
    expect(parseDate("2026-12-31").getDate()).toBe(31);
  });
});

describe("toDate", () => {
  it("treats a date-only string as a local day and anything else as a timestamp", () => {
    expect(toDate("2026-03-02").getDate()).toBe(2);
    expect(toDate(afternoon.toISOString()).getTime()).toBe(afternoon.getTime());
    expect(toDate(afternoon)).toBe(afternoon);
  });
});

describe("formatDate", () => {
  it.each([
    ["short", "pl", "02 mar"],
    ["short", "en", "Mar 02"],
    ["long", "pl", "02 mar 2026"],
    ["long", "en", "Mar 02, 2026"],
    ["dayTime", "pl", "02 mar, 14:30"],
    ["dayTime", "en", "Mar 02, 02:30 PM"],
    ["time", "pl", "14:30"],
    ["time", "en", "02:30 PM"],
  ] as const)("%s in %s", (style, locale, expected) => {
    expect(plain(formatDate(afternoon, style, locale))).toBe(expected);
  });

  it("formats a 'YYYY-MM-DD' string without shifting the day", () => {
    expect(plain(formatDate("2026-03-02", "long", "pl"))).toBe("02 mar 2026");
    expect(plain(formatDate("2026-03-02", "long", "en"))).toBe("Mar 02, 2026");
  });

  it("formats an ISO timestamp", () => {
    expect(plain(formatDate(afternoon.toISOString(), "dayTime", "pl"))).toBe("02 mar, 14:30");
  });

  it("renders a missing date as a dash", () => {
    expect(formatDate(null, "short", "pl")).toBe(NO_DATE);
    expect(formatDate(undefined, "long", "en")).toBe(NO_DATE);
    expect(formatDate("", "short", "en")).toBe(NO_DATE);
  });
});

describe("relative days", () => {
  const today = new Date(2026, 3, 20, 15, 0); // Mon, Apr 20 2026, 15:00 local

  it("dayOffset counts calendar days, ignoring the time of day", () => {
    expect(dayOffset(new Date(2026, 3, 20, 0, 5), today)).toBe(0);
    expect(dayOffset(new Date(2026, 3, 19, 23, 55), today)).toBe(-1);
    expect(dayOffset("2026-04-21", today)).toBe(1);
    expect(dayOffset("2026-04-10", today)).toBe(-10);
  });

  it("formatDayLabel says today / yesterday / tomorrow in each language", () => {
    expect(formatDayLabel(new Date(2026, 3, 20, 9, 0), "en", today)).toBe("Today");
    expect(formatDayLabel(new Date(2026, 3, 19, 9, 0), "en", today)).toBe("Yesterday");
    expect(formatDayLabel("2026-04-21", "en", today)).toBe("Tomorrow");
    expect(formatDayLabel(new Date(2026, 3, 20, 9, 0), "pl", today)).toBe("Dzisiaj");
    expect(formatDayLabel(new Date(2026, 3, 19, 9, 0), "pl", today)).toBe("Wczoraj");
  });

  it("formatDayLabel falls back to weekday + short date", () => {
    expect(plain(formatDayLabel("2026-04-10", "en", today))).toBe("Fri, Apr 10");
    expect(plain(formatDayLabel("2026-04-10", "pl", today))).toBe("pt., 10 kwi");
  });
});

describe("scheduleDeviationDays", () => {
  it("is positive when the current end date is later, negative when earlier", () => {
    expect(scheduleDeviationDays("2026-06-10", "2026-06-12")).toBe(2);
    expect(scheduleDeviationDays("2026-06-10", "2026-06-09")).toBe(-1);
  });

  it("is 0 when the dates are equal or one is missing", () => {
    expect(scheduleDeviationDays("2026-06-10", "2026-06-10")).toBe(0);
    expect(scheduleDeviationDays(null, "2026-06-10")).toBe(0);
    expect(scheduleDeviationDays("2026-06-10", null)).toBe(0);
  });

  it("counts calendar days across month ends, leap days and DST changes", () => {
    expect(scheduleDeviationDays("2026-01-31", "2026-03-01")).toBe(29);
    expect(scheduleDeviationDays("2028-02-28", "2028-03-01")).toBe(2);
    expect(scheduleDeviationDays("2026-03-28", "2026-03-30")).toBe(2);
    expect(scheduleDeviationDays("2026-10-24", "2026-10-26")).toBe(2);
  });
});

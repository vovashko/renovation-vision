import { describe, it, expect } from "vitest";
import { parseDate, slugify, fileExt } from "@/lib/format";
import { daysLate, daysUntil, budgetStatus } from "@/lib/attention";

// src/lib/attention.ts imports `isDemo` from `./supabase`, which reads
// import.meta.env. With no Supabase env vars set (the default in this test
// run), the app is in demo mode — that's fine, these functions are pure.

describe("parseDate", () => {
  it("parses 'YYYY-MM-DD' as a local date with no timezone shift", () => {
    const d = parseDate("2026-04-20");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // 0-indexed: April
    expect(d.getDate()).toBe(20);
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Living Room Drywall")).toBe("living-room-drywall");
  });

  it("strips leading/trailing separators", () => {
    expect(slugify("--Hello World!!--")).toBe("hello-world");
  });

  it("truncates to 24 characters", () => {
    expect(slugify("a".repeat(40))).toBe("a".repeat(24));
  });

  it("falls back to 'item' when nothing is left", () => {
    expect(slugify("!!!")).toBe("item");
  });
});

describe("fileExt", () => {
  it("returns the lowercased extension", () => {
    expect(fileExt("photo.JPG")).toBe("jpg");
    expect(fileExt("receipt.pdf")).toBe("pdf");
  });

  it("defaults to 'jpg' when there is no extension", () => {
    expect(fileExt("no-extension")).toBe("jpg");
  });
});

describe("daysLate", () => {
  const today = new Date(2026, 3, 20); // Apr 20, 2026

  it("is 0 when the item is done, even if past its end date", () => {
    expect(daysLate({ end_date: "2026-04-01", status: "done" }, today)).toBe(0);
  });

  it("is 0 when the end date is today or in the future", () => {
    expect(daysLate({ end_date: "2026-04-20", status: "progress" }, today)).toBe(0);
    expect(daysLate({ end_date: "2026-04-25", status: "progress" }, today)).toBe(0);
  });

  it("counts whole days past the end date", () => {
    expect(daysLate({ end_date: "2026-04-15", status: "progress" }, today)).toBe(5);
  });
});

describe("daysUntil", () => {
  const today = new Date(2026, 3, 20); // Apr 20, 2026

  it("is 0 for today", () => {
    expect(daysUntil("2026-04-20", today)).toBe(0);
  });

  it("is positive for a future date", () => {
    expect(daysUntil("2026-04-25", today)).toBe(5);
  });

  it("is negative for a past date", () => {
    expect(daysUntil("2026-04-15", today)).toBe(-5);
  });
});

describe("budgetStatus", () => {
  it("is not over when budget is 0", () => {
    const s = budgetStatus({ budget: 0, spent: 100 });
    expect(s.over).toBe(false);
    expect(s.overPct).toBe(0);
    expect(s.usedPct).toBe(0);
  });

  it("is not over when spent is under budget", () => {
    const s = budgetStatus({ budget: 1000, spent: 500 });
    expect(s.over).toBe(false);
    expect(s.overPct).toBe(0);
    expect(s.usedPct).toBe(50);
  });

  it("is over when spent exceeds budget, with rounded overrun and use", () => {
    const s = budgetStatus({ budget: 300, spent: 400 });
    expect(s.over).toBe(true);
    expect(s.overPct).toBe(33); // (400 - 300) / 300 = 33.33% rounded
    expect(s.usedPct).toBe(133); // 400 / 300 = 133.33% rounded
  });
});

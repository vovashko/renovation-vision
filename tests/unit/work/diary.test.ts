import { describe, it, expect } from "vitest";
import {
  diaryFormSchema,
  filterByStage,
  groupByDay,
  isoDay,
  latestVisible,
  parseHours,
  visibleToClient,
} from "@/features/work/domain/diary";
import type { ProgressEntry } from "@/lib/database.types";

const valid = {
  note: "Primed the walls",
  entry_date: "2026-11-02",
  stageId: "",
  roomId: "",
  hours: "",
  files: [],
  materialIds: [],
  is_visible: false,
};

function entry(over: Partial<ProgressEntry> & { id: string }): ProgressEntry {
  return {
    project_id: "p1",
    stage_id: null,
    room_id: null,
    entry_date: "2026-11-02",
    author_id: null,
    note: "note",
    hours: null,
    is_visible: false,
    created_at: "2026-11-02T08:00:00Z",
    updated_at: "2026-11-02T08:00:00Z",
    ...over,
  };
}

describe("parseHours", () => {
  it("accepts a dot or a decimal comma", () => {
    expect(parseHours("2")).toBe(2);
    expect(parseHours("1.5")).toBe(1.5);
    expect(parseHours("1,5")).toBe(1.5);
    expect(parseHours(" 0,25 ")).toBe(0.25);
  });
  it("rejects negatives, text and too many decimals", () => {
    for (const bad of ["-1", "abc", "1,555", "1.2.3", "", "1 000"]) expect(parseHours(bad)).toBeNull();
  });
});

describe("diaryFormSchema", () => {
  it("requires a note", () => {
    const r = diaryFormSchema.safeParse({ ...valid, note: "   " });
    expect(r.success).toBe(false);
  });
  it("turns empty hours into null and a decimal comma into a number", () => {
    expect(diaryFormSchema.parse(valid).hours).toBeNull();
    expect(diaryFormSchema.parse({ ...valid, hours: "2,5" }).hours).toBe(2.5);
    expect(diaryFormSchema.parse({ ...valid, hours: "0" }).hours).toBe(0);
  });
  it("rejects negative hours", () => {
    expect(diaryFormSchema.safeParse({ ...valid, hours: "-1" }).success).toBe(false);
  });
  it("requires a date", () => {
    expect(diaryFormSchema.safeParse({ ...valid, entry_date: "" }).success).toBe(false);
  });
});

describe("isoDay", () => {
  it("formats the local day", () => {
    expect(isoDay(new Date(2026, 10, 7))).toBe("2026-11-07");
  });
});

describe("groupByDay", () => {
  it("groups by day, newest day first and newest entry first within a day", () => {
    const days = groupByDay([
      entry({ id: "a", entry_date: "2026-11-01", created_at: "2026-11-01T08:00:00Z" }),
      entry({ id: "b", entry_date: "2026-11-03", created_at: "2026-11-03T08:00:00Z" }),
      entry({ id: "c", entry_date: "2026-11-03", created_at: "2026-11-03T15:00:00Z" }),
    ]);
    expect(days.map((d) => d.date)).toEqual(["2026-11-03", "2026-11-01"]);
    expect(days[0].entries.map((e) => e.id)).toEqual(["c", "b"]);
  });
  it("returns nothing for no entries", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("filterByStage", () => {
  const entries = [entry({ id: "a", stage_id: "s1" }), entry({ id: "b", stage_id: "s2" }), entry({ id: "c" })];
  it("keeps one stage's entries", () => {
    expect(filterByStage(entries, "s1").map((e) => e.id)).toEqual(["a"]);
  });
  it("keeps everything for an empty stage id", () => {
    expect(filterByStage(entries, "")).toHaveLength(3);
  });
});

describe("client visibility", () => {
  const entries = [
    entry({ id: "a", is_visible: true, entry_date: "2026-11-01" }),
    entry({ id: "b", is_visible: false, entry_date: "2026-11-05" }),
    entry({ id: "c", is_visible: true, entry_date: "2026-11-04" }),
    entry({ id: "d", is_visible: true, entry_date: "2026-11-03" }),
  ];
  it("drops internal entries", () => {
    expect(visibleToClient(entries).map((e) => e.id)).toEqual(["a", "c", "d"]);
  });
  it("selects the latest few visible entries for the overview card", () => {
    expect(latestVisible(entries, 2).map((e) => e.id)).toEqual(["c", "d"]);
  });
  it("does not mutate its input", () => {
    const before = entries.map((e) => e.id);
    latestVisible(entries, 2);
    expect(entries.map((e) => e.id)).toEqual(before);
  });
});

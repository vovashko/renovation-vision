import { describe, it, expect } from "vitest";
import { groupMessagesByDay } from "@/lib/chat-format";

type Msg = { id: string; created_at: string; body: string };

const msg = (id: string, created_at: string, body = id): Msg => ({ id, created_at, body });

describe("groupMessagesByDay", () => {
  const today = new Date(2026, 3, 20, 12, 0, 0); // Apr 20, 2026

  it("returns one bucket per day, in chronological order", () => {
    const messages = [
      msg("a", new Date(2026, 3, 19, 9, 0).toISOString()), // Yesterday
      msg("b", new Date(2026, 3, 19, 10, 0).toISOString()), // Yesterday
      msg("c", new Date(2026, 3, 20, 8, 0).toISOString()), // Today
    ];
    const groups = groupMessagesByDay(messages, (m) => m.created_at, today);
    expect(groups.map((g) => g.day)).toEqual(["Yesterday", "Today"]);
    expect(groups[0].items.map((m) => m.id)).toEqual(["a", "b"]);
    expect(groups[1].items.map((m) => m.id)).toEqual(["c"]);
  });

  it("preserves message order within a bucket", () => {
    const messages = [
      msg("first", new Date(2026, 3, 20, 9, 0).toISOString()),
      msg("second", new Date(2026, 3, 20, 9, 5).toISOString()),
      msg("third", new Date(2026, 3, 20, 9, 10).toISOString()),
    ];
    const groups = groupMessagesByDay(messages, (m) => m.created_at, today);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((m) => m.id)).toEqual(["first", "second", "third"]);
  });

  it("returns an empty array for no messages", () => {
    expect(groupMessagesByDay([], (m: Msg) => m.created_at, today)).toEqual([]);
  });

  it("starts a new bucket only when the day label changes", () => {
    const messages = [
      msg("a", new Date(2026, 3, 18, 9, 0).toISOString()),
      msg("b", new Date(2026, 3, 19, 9, 0).toISOString()),
      msg("c", new Date(2026, 3, 19, 10, 0).toISOString()),
      msg("d", new Date(2026, 3, 20, 9, 0).toISOString()),
    ];
    const groups = groupMessagesByDay(messages, (m) => m.created_at, today);
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.items.length)).toEqual([1, 2, 1]);
  });
});

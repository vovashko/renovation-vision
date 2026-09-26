// Pure formatting helpers for the chat page, kept out of the route so they're easy to unit test.
// `today` is a parameter (defaulting to `new Date()`) so tests can pin a date.

/** "Today" / "Yesterday" / "Mon, Apr 20" for a message's day separator. */
export function dayLabel(iso: string, today: Date = new Date()): string {
  const d = new Date(iso);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" });
}

export type DayGroup<T> = { day: string; items: T[] };

/**
 * Groups a chronologically-ordered list of items into day buckets, in place —
 * order is preserved and a new bucket only starts when the day label changes,
 * matching the day-separator behavior in the chat message list.
 */
export function groupMessagesByDay<T>(items: T[], getTimestamp: (item: T) => string, today: Date = new Date()): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const day = dayLabel(getTimestamp(item), today);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(item);
    } else {
      groups.push({ day, items: [item] });
    }
  }
  return groups;
}

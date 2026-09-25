import type { ScheduleStatus } from "./database.types";

/** Parse 'YYYY-MM-DD' as a local date (no timezone shift). */
export function parseDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

/** "Mar 02" — same format as the client app's stage dates. */
export function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return parseDate(d).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

/** "Mar 02, 2026" — same format as the client app's project dates. */
export function longDate(d: string | null | undefined) {
  if (!d) return "—";
  return parseDate(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export function money(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function dateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export const scheduleLabel: Record<ScheduleStatus, string> = {
  on_schedule: "On schedule",
  at_risk: "At risk",
  delayed: "Delayed",
};


export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 24) || "item";
}

export function fileExt(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "jpg";
}

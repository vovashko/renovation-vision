// Date parsing and locale-aware formatting. Pure: callers pass the locale (UI code gets it from
// `useFormat()` in `@/i18n`), so the same helpers work on the server, in tests and in the browser.

/** A date-only string ('YYYY-MM-DD'), an ISO timestamp, or a Date. */
export type DateInput = Date | string;

export type DateStyle = "short" | "long" | "dayTime" | "time";

/** Shown for a missing date, in every locale. */
export const NO_DATE = "—";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  // en "Mar 02", pl "02 mar"
  short: { month: "short", day: "2-digit" },
  // en "Mar 02, 2026", pl "02 mar 2026"
  long: { month: "short", day: "2-digit", year: "numeric" },
  // en "Mar 02, 02:30 PM", pl "02 mar, 14:30"
  dayTime: { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" },
  // en "02:30 PM", pl "14:30"
  time: { hour: "2-digit", minute: "2-digit" },
};

/** Parse 'YYYY-MM-DD' as a local date (no timezone shift). */
export function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

/** A Date from any `DateInput`: date-only strings are local days, anything else goes through `new Date()`. */
export function toDate(d: DateInput): Date {
  if (d instanceof Date) return d;
  return DATE_ONLY.test(d) ? parseDate(d) : new Date(d);
}

/** Format a date in one of the app's styles. A missing date renders as "—". */
export function formatDate(d: DateInput | null | undefined, style: DateStyle, locale: string): string {
  if (d == null || d === "") return NO_DATE;
  return new Intl.DateTimeFormat(locale, STYLES[style]).format(toDate(d));
}

const DAY_MS = 86_400_000;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Calendar days from `today` to `d` (0 today, -1 yesterday, 1 tomorrow), ignoring the time of day. */
export function dayOffset(d: DateInput, today: Date = new Date()): number {
  return Math.round((dayStart(toDate(d)) - dayStart(today)) / DAY_MS);
}

/**
 * Day label for a separator or a "last seen": "Today" / "Yesterday" / "Tomorrow" (localized by
 * `Intl.RelativeTimeFormat`), otherwise weekday + short date ("Mon, Mar 02", "pon., 02 mar").
 */
export function formatDayLabel(d: DateInput, locale: string, today: Date = new Date()): string {
  const offset = dayOffset(d, today);
  if (Math.abs(offset) <= 1) {
    const word = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(offset, "day");
    return word.charAt(0).toLocaleUpperCase(locale) + word.slice(1);
  }
  return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "2-digit" }).format(toDate(d));
}

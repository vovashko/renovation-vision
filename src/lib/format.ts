/**
 * @deprecated moved: dates to @/domain/dates, money to @/domain/money, slugify/fileExt to @/domain/text.
 * In components use `useFormat()` from @/i18n. These English-only helpers keep today's output
 * unchanged until each feature switches over; the shim goes away in T17.
 */
import en from "@/i18n/common/en.json";
import { formatDate } from "@/domain/dates";
import type { ScheduleStatus } from "./database.types";

export { parseDate } from "@/domain/dates";
export { fileExt, slugify } from "@/domain/text";

/** @deprecated "Mar 02". Use `useFormat().date(d, "short")`. */
export function shortDate(d: string | null | undefined) {
  return formatDate(d, "short", "en-US");
}

/** @deprecated "Mar 02, 2026". Use `useFormat().date(d, "long")`. */
export function longDate(d: string | null | undefined) {
  return formatDate(d, "long", "en-US");
}

/** @deprecated "$12,345" (whole dollars). Use `useFormat().money(amount, currency)`. */
export function money(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** @deprecated Use `useFormat().date(iso, "dayTime")`. */
export function dateTime(iso: string) {
  return formatDate(iso, "dayTime", "en-US");
}

/** @deprecated Use `useFormat().date(iso, "time")`. */
export function timeLabel(iso: string) {
  return formatDate(iso, "time", "en-US");
}

/** @deprecated English only. Use `useScheduleLabel()` from @/i18n or `t("common:schedule.<status>")`. */
export const scheduleLabel: Record<ScheduleStatus, string> = en.schedule;

/** @deprecated unused. */
export const scheduleFill: Record<ScheduleStatus, string> = {
  on_schedule: "var(--status-done)",
  at_risk: "var(--status-progress)",
  delayed: "var(--status-blocked)",
};

/** @deprecated moved to @/domain/attention. This shim goes away in T17. */
export { budgetStatus, daysLate, daysUntil, projectToday } from "@/domain/attention";

/** @deprecated English only. Use `t("common:attention.daysLate", { count: days })`. */
export function lateLabel(days: number) {
  return `${days} ${days === 1 ? "day" : "days"} late`;
}

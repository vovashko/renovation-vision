/** @deprecated moved to @/domain/status (labels: `common:status.*` / `useStatusLabel()` from @/i18n). This shim goes away in T17. */
import en from "@/i18n/common/en.json";
import type { Status } from "@/domain/status";

export { statuses, type Status } from "@/domain/status";

/** @deprecated English only. Use `useStatusLabel()` from @/i18n or `t("common:status.<status>")`. */
export const statusLabel: Record<Status, string> = en.status;

/** @deprecated unused; status colors live in @/lib/status-ui. */
export const statusColor: Record<Status, string> = {
  done: "bg-status-done",
  progress: "bg-status-progress",
  pending: "bg-status-pending",
  blocked: "bg-status-blocked",
};

/** @deprecated unused; status colors live in @/lib/status-ui. */
export const statusFill: Record<Status, string> = {
  done: "var(--status-done)",
  progress: "var(--status-progress)",
  pending: "var(--status-pending)",
  blocked: "var(--status-blocked)",
};

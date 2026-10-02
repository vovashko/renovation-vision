// Reading the `params` jsonb of notifications and activity rows (T33). The database writes a
// stable `kind` (notifications) or `{ entity, action, label }` (activity) plus values; the UI
// translates them (hooks/use-notification-text.ts). Rows can predate a kind or miss a value, so
// every reader here returns undefined instead of trusting the shape, and the UI then falls back
// to the legacy English `title`/`body`/`summary`.
import { scheduleStatuses, statuses, type ScheduleStatus, type Status } from "@/domain/status";

/** The notification kinds the app renders through i18n (see the T33 migration for each one's params). */
export const NOTIFICATION_KINDS = [
  "stage_status",
  "room_status",
  "photo_published",
  "render_published",
  "schedule_status",
  "message",
  "manual",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export function isNotificationKind(kind: unknown): kind is NotificationKind {
  return typeof kind === "string" && (NOTIFICATION_KINDS as readonly string[]).includes(kind);
}

/** `activity_log.params.entity` values the app has a label for. Anything else falls back to the summary. */
export const ACTIVITY_ENTITIES = [
  "project",
  "internal_notes",
  "member",
  "room",
  "stage",
  "task",
  "photo",
  "render",
  "expense",
  "ai_knowledge",
  "crew_member",
] as const;
export type ActivityEntity = (typeof ACTIVITY_ENTITIES)[number];

export const ACTIVITY_ACTIONS = ["insert", "update", "delete"] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

type Params = Record<string, unknown> | null | undefined;

/** A string value, or undefined when it's missing or not a string. */
export function paramText(params: Params, key: string): string | undefined {
  const value = params?.[key];
  return typeof value === "string" ? value : undefined;
}

/** A non-empty string value. */
export function paramName(params: Params, key: string): string | undefined {
  const value = paramText(params, key)?.trim();
  return value ? value : undefined;
}

export function paramFlag(params: Params, key: string): boolean {
  return params?.[key] === true;
}

export function paramStatus(params: Params, key = "status"): Status | undefined {
  const value = params?.[key];
  return (statuses as unknown[]).includes(value) ? (value as Status) : undefined;
}

export function paramScheduleStatus(params: Params, key = "status"): ScheduleStatus | undefined {
  const value = params?.[key];
  return (scheduleStatuses as unknown[]).includes(value) ? (value as ScheduleStatus) : undefined;
}

export function paramEntity(params: Params): ActivityEntity | undefined {
  const value = params?.entity;
  return (ACTIVITY_ENTITIES as readonly unknown[]).includes(value) ? (value as ActivityEntity) : undefined;
}

export function paramAction(params: Params): ActivityAction | undefined {
  const value = params?.action;
  return (ACTIVITY_ACTIONS as readonly unknown[]).includes(value) ? (value as ActivityAction) : undefined;
}

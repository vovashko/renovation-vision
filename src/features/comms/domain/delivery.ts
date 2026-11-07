// Notification delivery (T41): which kinds are emailed how, the preference groups on Settings → Notifications,
// the digest's daily boundary and where a notification leads. Pure: the email jobs (src/server/notifications) and
// the UI share it; the claim itself is public.claim_notification_emails (migration 20261108000200).
import type { NotificationKind } from "./params";

/**
 * Emailed by the change-request server functions and the reminder cron themselves (T61): a new request (clients),
 * an approval (managers) and the 24-hour reminder. The email jobs never claim them, so nobody gets two emails.
 * The removed chat's `message` and the old question/answer kinds are not written any more and are never emailed.
 */
export const DIRECTLY_EMAILED_KINDS: string[] = [
  "decision_new",
  "decision_accepted",
  "decision_reminder",
  "message",
  "decision_question",
  "decision_answer",
];

/**
 * The other change-request events: emailed at once whatever the preferences (owner decision: change requests
 * are always emailed instantly), by the instant job.
 */
export const ALWAYS_INSTANT_KINDS: string[] = ["decision_rejected", "decision_reopened"];

/** The instant job runs every 5 minutes and looks this far back (a longer outage drops the late ones). */
export const INSTANT_LOOKBACK_HOURS = 24;
/** The digest covers what came in before the latest 07:00 boundary, this far back (a missed day is caught up). */
export const DIGEST_LOOKBACK_HOURS = 48;
/** Recipients per run (one email each); the next run takes the rest. Keeps a run's subrequests bounded. */
export const RECIPIENTS_PER_RUN = 20;
/** Items listed in one email; the rest are summed up as "and N more". */
export const MAX_EMAIL_ITEMS = 30;

export const DIGEST_TIME_ZONE = "Europe/Warsaw";
export const DIGEST_HOUR = 7;

export type EmailFrequency = "instant" | "daily" | "off";
export const EMAIL_FREQUENCIES: EmailFrequency[] = ["instant", "daily", "off"];

export function isEmailFrequency(value: unknown): value is EmailFrequency {
  return typeof value === "string" && (EMAIL_FREQUENCIES as string[]).includes(value);
}

export type PreferenceGroupKey = "progress" | "media" | "documents" | "announcements";

/** The groups a user sets an email frequency for; each saves one `notification_preferences` row per kind. */
export const PREFERENCE_GROUPS: { key: PreferenceGroupKey; kinds: NotificationKind[] }[] = [
  { key: "progress", kinds: ["stage_status", "room_status", "schedule_status"] },
  { key: "media", kinds: ["photo_published", "render_published"] },
  { key: "documents", kinds: ["document_new"] },
  { key: "announcements", kinds: ["manual"] },
];

/** Offset of `timeZone` from UTC at `at`, in milliseconds (Warsaw: +1 h in winter, +2 h in summer). */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return local - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The latest `hour`:00 in `timeZone` at or before `now` (DST-safe): the digest sends what came in before it.
 * 06:59 Warsaw → yesterday 07:00; 07:00 → today 07:00.
 */
export function digestBoundary(now: Date, timeZone = DIGEST_TIME_ZONE, hour = DIGEST_HOUR): Date {
  const offsetNow = zoneOffsetMs(now, timeZone);
  const local = new Date(now.getTime() + offsetNow);
  let wall = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour);
  if (local.getTime() < wall) wall -= 86_400_000;
  // `wall` is a wall-clock time: convert it with the offset in force at that moment (yesterday's may differ).
  return new Date(wall - zoneOffsetMs(new Date(wall - offsetNow), timeZone));
}

/** The project sections a notification can lead to (its `link`); anything else opens the overview. */
const SECTIONS = ["progress", "stages", "plan", "photos", "design", "documents", "budget"] as const;
export type NotificationSection = "" | (typeof SECTIONS)[number];

export type NotificationTarget = { projectId: string; section: NotificationSection; request?: string };

type Linkable = { project_id: string; link: string | null; entity_type?: string | null; entity_id?: string | null };

/** Where opening a notification goes: its project section, and the change request it is about. */
export function notificationTarget(n: Linkable): NotificationTarget {
  const segment = (n.link ?? "").replace(/^\/+|\/+$/g, "");
  const section = (SECTIONS as readonly string[]).includes(segment) ? (segment as NotificationSection) : "";
  const request = n.entity_type === "decisions" && n.entity_id ? n.entity_id : undefined;
  return request ? { projectId: n.project_id, section, request } : { projectId: n.project_id, section };
}

/** The same target as a path (`/projects/<id>/<section>?request=<id>`), for links in emails. */
export function notificationPath(n: Linkable): string {
  const { projectId, section, request } = notificationTarget(n);
  const path = section ? `/projects/${projectId}/${section}` : `/projects/${projectId}`;
  return request ? `${path}?request=${request}` : path;
}

/** Groups rows by recipient, keeping their order (the claim returns them oldest first per recipient). */
export function groupByRecipient<T extends { recipient_id: string; created_at: string }>(rows: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const list = groups.get(row.recipient_id) ?? [];
    list.push(row);
    groups.set(row.recipient_id, list);
  }
  return groups;
}

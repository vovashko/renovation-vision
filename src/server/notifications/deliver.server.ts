// What the two notification email jobs (instant.server.ts, digest.server.ts) share: the app origin for links, the
// claim (public.claim_notification_emails), the recipients' address and language, and turning a recipient's rows
// into email items in that language.
//
// SERVER-ONLY.
import "@tanstack/react-start/server-only";
import { EnvError, getServerEnv, getWorkerBinding } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { createI18n } from "@/i18n/instance";
import type { Locale } from "@/i18n/locale";
import type { JsonParams, Notification } from "@/lib/database.types";
import {
  ALWAYS_INSTANT_KINDS,
  DIRECTLY_EMAILED_KINDS,
  MAX_EMAIL_ITEMS,
  RECIPIENTS_PER_RUN,
  groupByRecipient,
  notificationPath,
} from "@/features/comms/domain/delivery";
import { notificationText, type CommsT } from "@/features/comms/domain/notification-text";
import type { DigestEmailItem } from "../email/templates";

/**
 * The app's public origin for the links in these emails (`APP_ORIGIN`, as for the T61 reminder): a cron has no
 * request to take it from. Preview and production fail loudly without it; in development and test the jobs don't
 * run (null), so nothing is claimed.
 */
export function notificationEmailOrigin(): string | null {
  const raw = getWorkerBinding<string>("APP_ORIGIN")?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      throw new EnvError(`APP_ORIGIN must be the app's origin, e.g. https://<host>, but it is not a URL.`);
    }
  }
  const { appEnv } = getServerEnv();
  if (appEnv === "preview" || appEnv === "production") {
    throw new EnvError("APP_ORIGIN is not set: the notification emails need the app's origin for their links.");
  }
  return null;
}

export type ClaimedNotification = Notification;

/** Claims (marks emailed) the rows of up to RECIPIENTS_PER_RUN recipients; see the migration for the rules. */
export async function claimNotificationEmails(
  admin: AdminSupabase,
  args: { frequency: "instant" | "daily"; since: Date; until: Date },
): Promise<ClaimedNotification[]> {
  const { data, error } = await admin.rpc("claim_notification_emails", {
    p_frequency: args.frequency,
    p_since: args.since.toISOString(),
    p_until: args.until.toISOString(),
    p_recipients: RECIPIENTS_PER_RUN,
    p_skip_kinds: DIRECTLY_EMAILED_KINDS,
    p_instant_kinds: ALWAYS_INSTANT_KINDS,
  });
  if (error) throw error;
  return (data ?? []).map((n) => ({ ...n, params: (n.params ?? {}) as JsonParams }));
}

export type Recipient = { email: string; locale: Locale };

const localeOf = (value: unknown): Locale => (value === "en" ? "en" : "pl");

/** Each recipient's address (auth.users) and language (profiles.locale); one without an address is left out. */
export async function loadRecipients(admin: AdminSupabase, userIds: string[]): Promise<Map<string, Recipient>> {
  const { data: profiles, error } = await admin.from("profiles").select("id, locale").in("id", userIds);
  if (error) throw error;
  const locales = new Map((profiles ?? []).map((p) => [p.id, localeOf(p.locale)]));
  const recipients = new Map<string, Recipient>();
  await Promise.all(
    userIds.map(async (id) => {
      const { data, error: userError } = await admin.auth.admin.getUserById(id);
      const email = data?.user?.email;
      if (userError || !email) return;
      recipients.set(id, { email, locale: locales.get(id) ?? "pl" });
    }),
  );
  return recipients;
}

export async function loadProjectNames(admin: AdminSupabase, projectIds: string[]): Promise<Map<string, string>> {
  const { data, error } = await admin.from("projects").select("id, name").in("id", projectIds);
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id, p.name]));
}

/** A translate function per language, made once per run. */
export function translators(): (locale: Locale) => CommsT {
  const cache = new Map<Locale, CommsT>();
  return (locale) => {
    let t = cache.get(locale);
    if (!t) {
      t = createI18n(locale).getFixedT(locale, ["comms", "common"]) as CommsT;
      cache.set(locale, t);
    }
    return t;
  };
}

/**
 * One recipient's rows as email items, oldest first, in their language. With rows from several projects each
 * title starts with the project's name. At most MAX_EMAIL_ITEMS; `more` counts the rest.
 */
export function emailItems(
  t: CommsT,
  rows: ClaimedNotification[],
  projectNames: Map<string, string>,
): { items: DigestEmailItem[]; more: number; projectId: string | null } {
  const projects = new Set(rows.map((r) => r.project_id));
  const several = projects.size > 1;
  const items = rows.slice(0, MAX_EMAIL_ITEMS).map((row) => {
    const { title, body } = notificationText(t, row);
    const project = several ? projectNames.get(row.project_id) : undefined;
    return { title: project ? `${project} · ${title}` : title, body: body || undefined };
  });
  return { items, more: Math.max(rows.length - MAX_EMAIL_ITEMS, 0), projectId: several ? null : (rows[0]?.project_id ?? null) };
}

export const linkTo = (siteUrl: string, row: Parameters<typeof notificationPath>[0]) => `${siteUrl}${notificationPath(row)}`;
export const manageUrl = (siteUrl: string) => `${siteUrl}/settings/notifications`;

export type DeliveryResult = { claimed: number; recipients: number; emailed: number };

/**
 * Sends one email per recipient with `send`, each in their language. A recipient without an address, or whose send
 * fails, is logged and skipped: their rows stay claimed (at most once, never retried).
 */
export async function deliverToRecipients(
  admin: AdminSupabase,
  rows: ClaimedNotification[],
  send: (args: { recipient: Recipient; rows: ClaimedNotification[]; t: CommsT; projectNames: Map<string, string> }) => Promise<void>,
  log: ReturnType<typeof logger.child>,
): Promise<DeliveryResult> {
  if (rows.length === 0) return { claimed: 0, recipients: 0, emailed: 0 };
  const groups = groupByRecipient(rows);
  const [recipients, projectNames] = await Promise.all([
    loadRecipients(admin, [...groups.keys()]),
    loadProjectNames(admin, [...new Set(rows.map((r) => r.project_id))]),
  ]);
  const tFor = translators();
  const results = await Promise.allSettled(
    [...groups].map(async ([userId, list]) => {
      const recipient = recipients.get(userId);
      if (!recipient) return false;
      await send({ recipient, rows: list, t: tFor(recipient.locale), projectNames });
      return true;
    }),
  );
  for (const r of results) if (r.status === "rejected") log.error("notification email failed", { err: r.reason });
  const emailed = results.filter((r) => r.status === "fulfilled" && r.value).length;
  return { claimed: rows.length, recipients: groups.size, emailed };
}

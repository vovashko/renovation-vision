// The hourly cron (wrangler.jsonc → triggers.crons, src/server.ts → scheduled): one reminder per change request
// that has waited 24 hours for the client (since it was submitted or reopened). In-app plus email, in each
// client's language. T41 adds notification preferences and the digest to the same handler.
//
//   1. With the admin client (no user: this runs outside any request), list the pending, not-yet-reminded
//      requests whose pending_since is older than 24 hours, and keep those `isReminderDue` agrees with.
//   2. For each, `public.remind_decision` claims the reminder under a row lock (service role only): it re-checks
//      the rule, sets reminded_at and writes the clients' in-app `decision_reminder`. It returns false when the
//      request changed in between (approved, rejected, reopened) or another run got there first.
//   3. Only a claimed reminder is emailed, so overlapping runs never send twice.
//
// SERVER-ONLY.
import "@tanstack/react-start/server-only";
import { EnvError, getServerEnv, getWorkerBinding } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getAdminSupabase, type AdminSupabase } from "@/lib/supabase/admin";
import { isReminderDue, reminderCutoff } from "@/features/change-requests/domain/reminder";
import { emailProjectMembers, requestLink } from "../functions/decisions.server";

/** At most this many reminders per run; the next hourly run picks up the rest. */
export const REMINDER_BATCH = 200;

const log = logger.child({ fn: "changeRequestReminders" });

/**
 * The app's public origin for the links in reminder emails (`APP_ORIGIN`, a plain var in wrangler.jsonc or
 * .dev.vars): there is no request to take it from. Preview and production fail loudly without it; in
 * development and test the reminders are written in-app only (null).
 */
export function reminderSiteUrl(): string | null {
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
    throw new EnvError("APP_ORIGIN is not set: the change-request reminder emails need the app's origin for their links.");
  }
  return null;
}

export type ReminderRunResult = { due: number; reminded: number; emailed: number };

export async function sendChangeRequestReminders(
  deps: { admin?: AdminSupabase; now?: Date; siteUrl?: string | null } = {},
): Promise<ReminderRunResult> {
  const now = deps.now ?? new Date();
  const siteUrl = deps.siteUrl === undefined ? reminderSiteUrl() : deps.siteUrl;
  const admin = deps.admin ?? getAdminSupabase();

  const { data, error } = await admin
    .from("decisions")
    .select("id, project_id, title, cost_delta, days_delta, status, pending_since, reminded_at")
    .eq("status", "pending")
    .is("reminded_at", null)
    .lte("pending_since", reminderCutoff(now).toISOString())
    .order("pending_since", { ascending: true })
    .limit(REMINDER_BATCH);
  if (error) throw error;

  const due = (data ?? []).filter((r) => isReminderDue(r, now));
  let reminded = 0;
  let emailed = 0;
  for (const request of due) {
    const { data: claimed, error: claimError } = await admin.rpc("remind_decision", { p_decision: request.id });
    if (claimError) {
      log.error("could not claim a change request reminder", { requestId: request.id, err: claimError });
      continue;
    }
    if (!claimed) continue;
    reminded += 1;
    if (!siteUrl) continue;
    try {
      const target = { id: request.id, cost_delta: Number(request.cost_delta), days_delta: request.days_delta };
      emailed += await emailProjectMembers({
        admin,
        projectId: request.project_id,
        role: "client",
        kind: "changeRequestReminder",
        title: request.title,
        siteUrl,
        linkUrl: requestLink(siteUrl, request.project_id, target),
      });
    } catch (e) {
      // The in-app reminder is written and the reminder is claimed: it is not retried by email.
      log.error("change request reminder email failed", { requestId: request.id, err: e });
    }
  }
  log.info("change request reminders", { due: due.length, reminded, emailed, emails: siteUrl ? "on" : "off" });
  return { due: due.length, reminded, emailed };
}

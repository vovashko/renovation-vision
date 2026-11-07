// Which jobs a Cron Trigger runs (wrangler.jsonc → triggers.crons, src/server.ts → scheduled). Each job is loaded
// lazily, runs on its own (one failing doesn't stop the next), and a failure is logged, reported and rethrown at
// the end so the run shows as failed in the Cloudflare dashboard.
//
//   0 * * * *     change-request reminders (T61): a request waiting 24 hours for the client
//   */5 * * * *   notification emails (T41): the instant ones, then the daily digest (sent by the first run after
//                 07:00 Europe/Warsaw; the other runs find nothing to digest)
//
// Five minutes keeps "right away" close to real time while batching bursts (ten photos published together become
// one email) and costing two cheap indexed queries per run when there is nothing to send. The digest rides the same
// cron instead of fixed UTC hours, so its 07:00 follows Warsaw's daylight saving time.
//
// SERVER-ONLY.
import "@tanstack/react-start/server-only";
import { logger } from "@/lib/logger";
import { captureServerException } from "@/lib/sentry-worker";

export const CRONS = { hourly: "0 * * * *", everyFiveMinutes: "*/5 * * * *" } as const;

export type JobName = "changeRequestReminders" | "instantNotificationEmails" | "notificationDigests";

export function jobsForCron(cron: string): JobName[] {
  switch (cron) {
    case CRONS.hourly:
      return ["changeRequestReminders"];
    case CRONS.everyFiveMinutes:
      return ["instantNotificationEmails", "notificationDigests"];
    default:
      return [];
  }
}

export type JobRunners = Record<JobName, (now: Date) => Promise<unknown>>;

const defaultRunners: JobRunners = {
  changeRequestReminders: async (now) => (await import("./change-request-reminders.server")).sendChangeRequestReminders({ now }),
  instantNotificationEmails: async (now) => (await import("../notifications/instant.server")).sendInstantNotificationEmails({ now }),
  notificationDigests: async (now) => (await import("../notifications/digest.server")).sendNotificationDigests({ now }),
};

export async function runScheduledJobs(cron: string, now: Date, runners: JobRunners = defaultRunners): Promise<JobName[]> {
  const jobs = jobsForCron(cron);
  if (jobs.length === 0) logger.warn("no job for this cron", { cron });
  const failures: unknown[] = [];
  for (const job of jobs) {
    try {
      await runners[job](now);
    } catch (error) {
      logger.error(error, { phase: "cron", job });
      captureServerException(error); // no-op without SENTRY_DSN
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, `${failures.length} cron jobs failed`);
  return jobs;
}

// The 24-hour reminder rule, shared by the hourly cron (src/server/jobs/change-request-reminders.server.ts) and
// mirrored by `public.remind_decision`, which re-checks it under a row lock. Pure.

/** A pending request is reminded once, this long after it was submitted or reopened. */
export const REMINDER_AFTER_HOURS = 24;

export type ReminderCandidate = { status: string; pending_since: string | null; reminded_at: string | null };

/** The cut-off: a request pending since before this is due. */
export const reminderCutoff = (now: Date) => new Date(now.getTime() - REMINDER_AFTER_HOURS * 3_600_000);

/** Pending, waiting 24 hours or more, and not reminded yet (reopening clears `reminded_at` and restarts the clock). */
export function isReminderDue(request: ReminderCandidate, now: Date): boolean {
  if (request.status !== "pending" || request.reminded_at !== null || !request.pending_since) return false;
  return new Date(request.pending_since).getTime() <= reminderCutoff(now).getTime();
}

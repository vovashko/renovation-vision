// The Cron Trigger routing (src/server/jobs/scheduled.server.ts, src/server.ts → scheduled): which jobs each cron
// runs, that one failing job doesn't stop the next, and that wrangler.jsonc declares the same crons in every env.
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CRONS, jobsForCron, runScheduledJobs, type JobRunners } from "@/server/jobs/scheduled.server";

const NOW = new Date("2026-11-07T06:05:00Z");

function runners(fail: Partial<Record<keyof JobRunners, Error>> = {}) {
  const ran: [string, Date][] = [];
  const make =
    (name: keyof JobRunners) =>
    async (now: Date): Promise<void> => {
      ran.push([name, now]);
      if (fail[name]) throw fail[name];
    };
  const all: JobRunners = {
    changeRequestReminders: make("changeRequestReminders"),
    instantNotificationEmails: make("instantNotificationEmails"),
    notificationDigests: make("notificationDigests"),
  };
  return { all, ran };
}

beforeEach(() => {
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("jobsForCron", () => {
  it("hourly: the change-request reminders; every 5 minutes: instant emails, then the digest; anything else: nothing", () => {
    expect(jobsForCron("0 * * * *")).toEqual(["changeRequestReminders"]);
    expect(jobsForCron("*/5 * * * *")).toEqual(["instantNotificationEmails", "notificationDigests"]);
    expect(jobsForCron("0 7 * * *")).toEqual([]);
  });
});

describe("runScheduledJobs", () => {
  it("runs the cron's jobs in order with the scheduled time", async () => {
    const { all, ran } = runners();
    await expect(runScheduledJobs(CRONS.everyFiveMinutes, NOW, all)).resolves.toEqual(["instantNotificationEmails", "notificationDigests"]);
    expect(ran).toEqual([
      ["instantNotificationEmails", NOW],
      ["notificationDigests", NOW],
    ]);
  });

  it("a failing job doesn't stop the next one, and the run still fails", async () => {
    const boom = new Error("instant failed");
    const { all, ran } = runners({ instantNotificationEmails: boom });
    await expect(runScheduledJobs(CRONS.everyFiveMinutes, NOW, all)).rejects.toBe(boom);
    expect(ran.map(([name]) => name)).toEqual(["instantNotificationEmails", "notificationDigests"]);
  });

  it("two failures surface together", async () => {
    const { all } = runners({ instantNotificationEmails: new Error("a"), notificationDigests: new Error("b") });
    await expect(runScheduledJobs(CRONS.everyFiveMinutes, NOW, all)).rejects.toBeInstanceOf(AggregateError);
  });

  it("the hourly cron leaves the notification jobs alone; an unknown cron runs nothing", async () => {
    const { all, ran } = runners();
    await runScheduledJobs(CRONS.hourly, NOW, all);
    await runScheduledJobs("15 3 * * *", NOW, all);
    expect(ran.map(([name]) => name)).toEqual(["changeRequestReminders"]);
  });
});

describe("wrangler.jsonc triggers", () => {
  it("declares both crons at the top level and in every env", () => {
    const raw = fs.readFileSync(path.resolve(__dirname, "../../../wrangler.jsonc"), "utf8");
    // JSONC → JSON: drop // comments (none of the values contain "//" after a space) and trailing commas.
    const json = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1")) as {
      triggers: { crons: string[] };
      env: Record<string, { triggers?: { crons: string[] } }>;
    };
    const expected = [CRONS.hourly, CRONS.everyFiveMinutes];
    expect(json.triggers.crons).toEqual(expected);
    for (const [name, env] of Object.entries(json.env)) expect(env.triggers?.crons, name).toEqual(expected);
  });
});

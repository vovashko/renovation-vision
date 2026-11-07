// The Worker entry's `scheduled` handler (src/server.ts): hands the trigger's cron and scheduled time to
// runScheduledJobs and lets a failure through (so Cloudflare marks the run failed).
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ calls: [] as [string, Date][], fail: null as Error | null }));

vi.mock("@/server/jobs/scheduled.server", () => ({
  runScheduledJobs: async (cron: string, now: Date) => {
    h.calls.push([cron, now]);
    if (h.fail) throw h.fail;
    return [];
  },
}));
vi.mock("@/lib/sentry-worker", () => ({
  wrapWithSentry: (handler: unknown) => handler,
  tagRequestId: () => {},
  captureServerException: () => {},
}));

const { default: worker } = (await import("../../../src/server.ts")) as unknown as {
  default: { scheduled: (controller: unknown, env: unknown, ctx: unknown) => Promise<void> };
};

describe("worker.scheduled", () => {
  it("routes the trigger's cron with its scheduled time", async () => {
    const scheduledTime = Date.parse("2026-11-07T06:05:00Z");
    await worker.scheduled({ cron: "*/5 * * * *", scheduledTime }, {}, {});
    await worker.scheduled({ cron: "0 * * * *", scheduledTime }, {}, {});
    expect(h.calls).toEqual([
      ["*/5 * * * *", new Date(scheduledTime)],
      ["0 * * * *", new Date(scheduledTime)],
    ]);
  });

  it("rethrows a failed run", async () => {
    h.fail = new Error("digest failed");
    await expect(worker.scheduled({ cron: "*/5 * * * *", scheduledTime: Date.now() }, {}, {})).rejects.toThrow("digest failed");
    h.fail = null;
  });
});

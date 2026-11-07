// The hourly change-request reminder (T61): which requests are due, the claim through remind_decision, the
// clients' email in their language, and APP_ORIGIN handling. The admin client is a fake.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetWorkerEnv } from "../../stubs/cloudflare-workers";

const h = vi.hoisted(() => ({
  sent: [] as { to: string; template: string; locale: string; params: Record<string, unknown> }[],
}));

vi.mock("@/server/email/send-email.server", () => ({
  sendEmail: async (input: { to: string; template: string; locale: string; params: Record<string, unknown> }) => void h.sent.push(input),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestUrl: () => new URL("https://unused.test") }));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminSupabase: () => {
    throw new Error("the tests pass their own admin client");
  },
}));

const { sendChangeRequestReminders, reminderSiteUrl } = await import("@/server/jobs/change-request-reminders.server");

const NOW = new Date("2026-10-10T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

type Row = {
  id: string;
  project_id: string;
  title: string;
  cost_delta: number;
  days_delta: number;
  status: string;
  pending_since: string | null;
  reminded_at: string | null;
};

const row = (over: Partial<Row>): Row => ({
  id: "r1",
  project_id: "p1",
  title: "Extra socket",
  cost_delta: 880,
  days_delta: 0,
  status: "pending",
  pending_since: hoursAgo(30),
  reminded_at: null,
  ...over,
});

/**
 * A fake admin client. `rows` is what the due-requests query returns (the real filters run in SQL; the handler
 * re-checks them). `claims` says what remind_decision answers per id (default true). Two clients per project:
 * Sarah (Polish) and Tom (English).
 */
function fakeAdmin(rows: Row[], claims: Record<string, boolean> = {}) {
  const queries: [string, unknown[]][] = [];
  const rpcCalls: { fn: string; args: { p_decision: string } }[] = [];
  const emails: Record<string, string> = { u1: "sarah@renovision.demo", u2: "tom@renovision.demo" };
  const locales: Record<string, string> = { u1: "pl", u2: "en" };
  const admin = {
    from: (table: string) => {
      let id = "";
      const q: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is", "lte", "order", "limit"]) {
        q[method] = (...args: unknown[]) => {
          if (table === "decisions") queries.push([method, args]);
          if (method === "eq" && args[0] === "id") id = String(args[1]);
          return q;
        };
      }
      q.maybeSingle = async () => ({ data: { locale: locales[id] }, error: null });
      q.then = (resolve: (v: unknown) => unknown) =>
        resolve(table === "decisions" ? { data: rows, error: null } : { data: [{ user_id: "u1" }, { user_id: "u2" }], error: null });
      return q;
    },
    rpc: async (fn: string, args: { p_decision: string }) => {
      rpcCalls.push({ fn, args });
      return { data: claims[args.p_decision] ?? true, error: null };
    },
    auth: { admin: { getUserById: async (uid: string) => ({ data: { user: { email: emails[uid] } }, error: null }) } },
  };
  return { admin: admin as never, queries, rpcCalls };
}

beforeEach(() => {
  h.sent = [];
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  resetWorkerEnv();
});

describe("sendChangeRequestReminders", () => {
  it("asks the database for pending, not-yet-reminded requests older than 24 hours", async () => {
    const { admin, queries } = fakeAdmin([]);
    await sendChangeRequestReminders({ admin, now: NOW, siteUrl: "https://app.test" });
    expect(queries).toEqual(
      expect.arrayContaining([
        ["eq", ["status", "pending"]],
        ["is", ["reminded_at", null]],
        ["lte", ["pending_since", hoursAgo(24)]],
      ]),
    );
  });

  it("due: claims the reminder and emails each client in their language, linking to the request", async () => {
    const { admin, rpcCalls } = fakeAdmin([row({ id: "due" })]);
    const result = await sendChangeRequestReminders({ admin, now: NOW, siteUrl: "https://app.test" });
    expect(rpcCalls).toEqual([{ fn: "remind_decision", args: { p_decision: "due" } }]);
    expect(result).toEqual({ due: 1, reminded: 1, emailed: 2 });
    expect(h.sent.map((m) => [m.to, m.locale])).toEqual([
      ["sarah@renovision.demo", "pl"],
      ["tom@renovision.demo", "en"],
    ]);
    expect(h.sent[0].params).toMatchObject({
      title: "Nadal czeka na Twoją akceptację: Extra socket",
      linkUrl: "https://app.test/projects/p1/budget?request=due",
    });
    expect(h.sent[1].params.title).toBe("Still waiting for your approval: Extra socket");
  });

  it("not due (under 24 hours) and already reminded: no claim, no email", async () => {
    const { admin, rpcCalls } = fakeAdmin([
      row({ id: "fresh", pending_since: hoursAgo(5) }),
      row({ id: "reminded", reminded_at: hoursAgo(2) }),
      row({ id: "approved", status: "accepted" }),
    ]);
    const result = await sendChangeRequestReminders({ admin, now: NOW, siteUrl: "https://app.test" });
    expect(rpcCalls).toEqual([]);
    expect(result).toEqual({ due: 0, reminded: 0, emailed: 0 });
    expect(h.sent).toEqual([]);
  });

  it("reopened in between (or another run claimed it): remind_decision refuses and nothing is emailed", async () => {
    const { admin, rpcCalls } = fakeAdmin([row({ id: "reopened" }), row({ id: "days", cost_delta: 0, days_delta: 3 })], {
      reopened: false,
    });
    const result = await sendChangeRequestReminders({ admin, now: NOW, siteUrl: "https://app.test" });
    expect(rpcCalls.map((c) => c.args.p_decision)).toEqual(["reopened", "days"]);
    expect(result).toEqual({ due: 2, reminded: 1, emailed: 2 });
    expect(h.sent.every((m) => String(m.params.linkUrl).endsWith("/progress?request=days"))).toBe(true);
  });

  it("without a site URL (development) the reminder is claimed in-app only", async () => {
    const { admin, rpcCalls } = fakeAdmin([row({ id: "due" })]);
    const result = await sendChangeRequestReminders({ admin, now: NOW, siteUrl: null });
    expect(rpcCalls).toHaveLength(1);
    expect(result).toEqual({ due: 1, reminded: 1, emailed: 0 });
    expect(h.sent).toEqual([]);
  });
});

describe("reminderSiteUrl", () => {
  it("uses APP_ORIGIN's origin", () => {
    resetWorkerEnv({ APP_ENV: "preview", APP_ORIGIN: "https://renovision-preview.example.dev/" });
    expect(reminderSiteUrl()).toBe("https://renovision-preview.example.dev");
  });

  it("fails loudly in preview and production without it; development goes in-app only", () => {
    resetWorkerEnv({ APP_ENV: "production" });
    expect(() => reminderSiteUrl()).toThrow(/APP_ORIGIN is not set/);
    resetWorkerEnv({ APP_ENV: "development" });
    expect(reminderSiteUrl()).toBeNull();
    resetWorkerEnv({ APP_ENV: "preview", APP_ORIGIN: "not a url" });
    expect(() => reminderSiteUrl()).toThrow(/APP_ORIGIN/);
  });
});

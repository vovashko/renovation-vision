// The instant notification emails (T41): what the claim asks for (only `instant`, never the kinds T61 emails itself,
// the change-request kinds forced to instant), one email per recipient in their language, and a claimed row is never
// sent again. The admin client is a fake (tests/unit/comms/_delivery-fakes.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetWorkerEnv } from "../../stubs/cloudflare-workers";
import { NOBODY, SARAH, TOM, claimed, fakeAdmin } from "./_delivery-fakes";

const h = vi.hoisted(() => ({
  sent: [] as { to: string; template: string; locale: string; params: Record<string, unknown> }[],
  fail: new Set<string>(),
}));

vi.mock("@/server/email/send-email.server", () => ({
  sendEmail: async (input: { to: string; template: string; locale: string; params: Record<string, unknown> }) => {
    if (h.fail.has(input.to)) throw new Error("Brevo said no");
    h.sent.push(input);
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminSupabase: () => {
    throw new Error("the tests pass their own admin client");
  },
}));

const { sendInstantNotificationEmails } = await import("@/server/notifications/instant.server");
const { notificationEmailOrigin } = await import("@/server/notifications/deliver.server");
const { ALWAYS_INSTANT_KINDS, DIRECTLY_EMAILED_KINDS } = await import("@/features/comms/domain/delivery");

const NOW = new Date("2026-11-07T12:00:00Z");
const SITE = "https://app.test";

beforeEach(() => {
  h.sent = [];
  h.fail = new Set();
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  resetWorkerEnv();
});

describe("sendInstantNotificationEmails", () => {
  it("claims only instant rows of the last 24 hours, skipping the kinds T61 emails and forcing the other change-request kinds", async () => {
    const { admin, rpcCalls } = fakeAdmin([]);
    await sendInstantNotificationEmails({ admin, now: NOW, siteUrl: SITE });
    expect(rpcCalls).toEqual([
      {
        fn: "claim_notification_emails",
        args: {
          p_frequency: "instant",
          p_since: "2026-11-06T12:00:00.000Z",
          p_until: NOW.toISOString(),
          p_recipients: 20,
          p_skip_kinds: DIRECTLY_EMAILED_KINDS,
          p_instant_kinds: ALWAYS_INSTANT_KINDS,
        },
      },
    ]);
    expect(DIRECTLY_EMAILED_KINDS).toEqual(expect.arrayContaining(["decision_new", "decision_accepted", "decision_reminder"]));
    expect(ALWAYS_INSTANT_KINDS).toEqual(["decision_rejected", "decision_reopened"]);
    expect(ALWAYS_INSTANT_KINDS.filter((k) => DIRECTLY_EMAILED_KINDS.includes(k))).toEqual([]);
  });

  it("one row: a notification email in the recipient's language, linking to its target", async () => {
    const { admin } = fakeAdmin([
      [
        claimed({ recipient_id: SARAH, kind: "stage_status", params: { stage: "Flooring", status: "done" }, link: "/stages" }),
        claimed({
          recipient_id: TOM,
          kind: "decision_reopened",
          params: { title: "Extra socket", text: "" },
          link: "/budget",
          entity_type: "decisions",
          entity_id: "r1",
        }),
      ],
    ]);
    const result = await sendInstantNotificationEmails({ admin, now: NOW, siteUrl: SITE });
    expect(result).toEqual({ claimed: 2, recipients: 2, emailed: 2 });
    const byTo = Object.fromEntries(h.sent.map((m) => [m.to, m]));
    expect(byTo["sarah@renovision.demo"]).toMatchObject({
      template: "notification",
      locale: "pl",
      params: {
        title: "Aktualizacja etapu: Flooring",
        body: "Etap Flooring ma teraz status: ukończone.",
        linkUrl: `${SITE}/projects/p1/stages`,
        manageUrl: `${SITE}/settings/notifications`,
      },
    });
    expect(byTo["tom@renovision.demo"]).toMatchObject({
      template: "notification",
      locale: "en",
      params: { title: "Reopened: Extra socket", linkUrl: `${SITE}/projects/p1/budget?request=r1` },
    });
  });

  it("several rows for one person: one batch email (digest template, its own subject), all of them listed", async () => {
    const { admin } = fakeAdmin([
      [
        claimed({ recipient_id: TOM, params: { caption: "Tiles in." } }),
        claimed({ recipient_id: TOM, kind: "document_new", params: { name: "Contract.pdf" }, body: "" }),
        claimed({ recipient_id: TOM, project_id: "p2", kind: "manual", params: { title: "Water off", body: "Thursday" } }),
      ],
    ]);
    await sendInstantNotificationEmails({ admin, now: NOW, siteUrl: SITE });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({
      to: "tom@renovision.demo",
      template: "digest",
      locale: "en",
      params: {
        subject: "3 new updates — RenoVision",
        heading: "New on your projects",
        linkUrl: `${SITE}/`,
        more: 0,
        items: [
          { title: "Maple Street · New site photo", body: "Tiles in." },
          { title: "Maple Street · New document: Contract.pdf" },
          { title: "Oak Avenue · Water off", body: "Thursday" },
        ],
      },
    });
  });

  it("never re-sends: a second run whose claim finds nothing sends nothing", async () => {
    const { admin, rpcCalls } = fakeAdmin([[claimed({ recipient_id: SARAH })], []]);
    await sendInstantNotificationEmails({ admin, now: NOW, siteUrl: SITE });
    await sendInstantNotificationEmails({ admin, now: new Date(NOW.getTime() + 5 * 60_000), siteUrl: SITE });
    expect(rpcCalls).toHaveLength(2);
    expect(h.sent).toHaveLength(1);
  });

  it("a recipient without an address, or whose send fails, doesn't stop the others", async () => {
    h.fail.add("sarah@renovision.demo");
    const { admin } = fakeAdmin([[claimed({ recipient_id: SARAH }), claimed({ recipient_id: NOBODY }), claimed({ recipient_id: TOM })]]);
    const result = await sendInstantNotificationEmails({ admin, now: NOW, siteUrl: SITE });
    expect(result).toEqual({ claimed: 3, recipients: 3, emailed: 1 });
    expect(h.sent.map((m) => m.to)).toEqual(["tom@renovision.demo"]);
  });

  it("without a site URL (development) nothing is claimed", async () => {
    const { admin, rpcCalls } = fakeAdmin([[claimed({})]]);
    expect(await sendInstantNotificationEmails({ admin, now: NOW, siteUrl: null })).toEqual({ claimed: 0, recipients: 0, emailed: 0 });
    expect(rpcCalls).toEqual([]);
  });
});

describe("notificationEmailOrigin", () => {
  it("uses APP_ORIGIN; preview and production fail loudly without it; development is off", () => {
    resetWorkerEnv({ APP_ENV: "preview", APP_ORIGIN: "https://renovision-preview.example.dev/" });
    expect(notificationEmailOrigin()).toBe("https://renovision-preview.example.dev");
    resetWorkerEnv({ APP_ENV: "production" });
    expect(() => notificationEmailOrigin()).toThrow(/APP_ORIGIN is not set/);
    resetWorkerEnv({ APP_ENV: "development" });
    expect(notificationEmailOrigin()).toBeNull();
  });
});

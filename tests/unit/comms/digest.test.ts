// The daily digest (T41): the 07:00 Europe/Warsaw boundary (DST-safe), what the claim asks for (only `daily`, rows
// before the boundary), one digest per recipient with every row of theirs in their language, and the template's
// extras ("and N more", the settings link). Also: every notification kind has a delivery rule.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetWorkerEnv } from "../../stubs/cloudflare-workers";
import { SARAH, TOM, claimed, fakeAdmin } from "./_delivery-fakes";

const h = vi.hoisted(() => ({
  sent: [] as { to: string; template: string; locale: string; params: Record<string, unknown> }[],
}));

vi.mock("@/server/email/send-email.server", () => ({
  sendEmail: async (input: { to: string; template: string; locale: string; params: Record<string, unknown> }) => void h.sent.push(input),
}));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminSupabase: () => {
    throw new Error("the tests pass their own admin client");
  },
}));

const { sendNotificationDigests } = await import("@/server/notifications/digest.server");
const { renderDigestEmail } = await import("@/server/email/templates/digest");
const delivery = await import("@/features/comms/domain/delivery");
const { NOTIFICATION_KINDS } = await import("@/features/comms/domain/params");
const {
  ALWAYS_INSTANT_KINDS,
  DIRECTLY_EMAILED_KINDS,
  MAX_EMAIL_ITEMS,
  PREFERENCE_GROUPS,
  digestBoundary,
  groupByRecipient,
  notificationPath,
} = delivery;

const SITE = "https://app.test";

beforeEach(() => {
  h.sent = [];
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  resetWorkerEnv();
});

describe("digestBoundary: the latest 07:00 in Warsaw", () => {
  it("winter (UTC+1): 07:00 Warsaw is 06:00 UTC", () => {
    expect(digestBoundary(new Date("2026-11-07T06:05:00Z")).toISOString()).toBe("2026-11-07T06:00:00.000Z");
    expect(digestBoundary(new Date("2026-11-07T06:00:00Z")).toISOString()).toBe("2026-11-07T06:00:00.000Z");
    expect(digestBoundary(new Date("2026-11-07T05:59:00Z")).toISOString()).toBe("2026-11-06T06:00:00.000Z");
    expect(digestBoundary(new Date("2026-11-07T23:30:00Z")).toISOString()).toBe("2026-11-07T06:00:00.000Z");
  });

  it("summer (UTC+2): 07:00 Warsaw is 05:00 UTC", () => {
    expect(digestBoundary(new Date("2026-07-01T05:05:00Z")).toISOString()).toBe("2026-07-01T05:00:00.000Z");
    expect(digestBoundary(new Date("2026-07-01T04:59:00Z")).toISOString()).toBe("2026-06-30T05:00:00.000Z");
  });

  it("the days daylight saving time changes", () => {
    // 2026-03-29: clocks go forward at 02:00. Before 07:00 that day, the boundary is the day before (still UTC+1).
    expect(digestBoundary(new Date("2026-03-29T04:30:00Z")).toISOString()).toBe("2026-03-28T06:00:00.000Z");
    expect(digestBoundary(new Date("2026-03-29T05:00:00Z")).toISOString()).toBe("2026-03-29T05:00:00.000Z");
    // 2026-10-25: clocks go back at 03:00.
    expect(digestBoundary(new Date("2026-10-25T05:30:00Z")).toISOString()).toBe("2026-10-24T05:00:00.000Z");
    expect(digestBoundary(new Date("2026-10-25T06:00:00Z")).toISOString()).toBe("2026-10-25T06:00:00.000Z");
  });
});

describe("delivery rules", () => {
  it("every notification kind is in a preference group, emailed by T61, or always instant", () => {
    const grouped = PREFERENCE_GROUPS.flatMap((g) => g.kinds as string[]);
    const covered = new Set([...grouped, ...DIRECTLY_EMAILED_KINDS, ...ALWAYS_INSTANT_KINDS]);
    expect(NOTIFICATION_KINDS.filter((k) => !covered.has(k))).toEqual([]);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped.filter((k) => k.startsWith("decision_"))).toEqual([]);
  });

  it("groups rows per recipient, oldest first", () => {
    const rows = [
      { id: "b", recipient_id: TOM, created_at: "2026-11-07T10:02:00Z" },
      { id: "a", recipient_id: SARAH, created_at: "2026-11-07T10:01:00Z" },
      { id: "c", recipient_id: TOM, created_at: "2026-11-07T10:00:00Z" },
    ];
    const groups = groupByRecipient(rows);
    expect([...groups.keys()]).toEqual([TOM, SARAH]);
    expect(groups.get(TOM)!.map((r) => r.id)).toEqual(["c", "b"]);
  });

  it("links to the notification's section, the overview for anything else, and the change request it is about", () => {
    expect(notificationPath({ project_id: "p1", link: "/photos" })).toBe("/projects/p1/photos");
    expect(notificationPath({ project_id: "p1", link: "/" })).toBe("/projects/p1");
    expect(notificationPath({ project_id: "p1", link: "/chat" })).toBe("/projects/p1");
    expect(notificationPath({ project_id: "p1", link: "https://evil.test" })).toBe("/projects/p1");
    expect(notificationPath({ project_id: "p1", link: null })).toBe("/projects/p1");
    expect(notificationPath({ project_id: "p1", link: "/progress", entity_type: "decisions", entity_id: "r9" })).toBe(
      "/projects/p1/progress?request=r9",
    );
  });
});

describe("sendNotificationDigests", () => {
  it("claims only daily rows from the 48 hours before the latest 07:00 Warsaw", async () => {
    const { admin, rpcCalls } = fakeAdmin([]);
    await sendNotificationDigests({ admin, now: new Date("2026-11-07T06:05:00Z"), siteUrl: SITE });
    expect(rpcCalls).toEqual([
      {
        fn: "claim_notification_emails",
        args: expect.objectContaining({
          p_frequency: "daily",
          p_since: "2026-11-05T06:00:00.000Z",
          p_until: "2026-11-07T06:00:00.000Z",
          p_skip_kinds: DIRECTLY_EMAILED_KINDS,
          p_instant_kinds: ALWAYS_INSTANT_KINDS,
        }),
      },
    ]);
  });

  it("one digest per recipient, every row of theirs, in their language", async () => {
    const { admin } = fakeAdmin([
      [
        claimed({ recipient_id: SARAH, kind: "stage_status", params: { stage: "Flooring", status: "progress" } }),
        claimed({ recipient_id: TOM, kind: "render_published", params: { title: "Kitchen", description: "Oak shelves." } }),
        claimed({ recipient_id: SARAH, kind: "document_new", params: { name: "Umowa.pdf" }, body: "" }),
      ],
    ]);
    const result = await sendNotificationDigests({ admin, now: new Date("2026-11-07T06:05:00Z"), siteUrl: SITE });
    expect(result).toEqual({ claimed: 3, recipients: 2, emailed: 2 });
    const byTo = Object.fromEntries(h.sent.map((m) => [m.to, m]));
    expect(byTo["sarah@renovision.demo"]).toMatchObject({
      template: "digest",
      locale: "pl",
      params: {
        linkUrl: `${SITE}/projects/p1`,
        manageUrl: `${SITE}/settings/notifications`,
        items: [
          { title: "Aktualizacja etapu: Flooring", body: "Etap Flooring ma teraz status: w toku." },
          { title: "Nowy dokument: Umowa.pdf" },
        ],
      },
    });
    expect(byTo["sarah@renovision.demo"].params.subject).toBeUndefined(); // the digest's own subject
    expect(byTo["tom@renovision.demo"]).toMatchObject({
      locale: "en",
      params: { items: [{ title: "New design render: Kitchen", body: "Oak shelves." }] },
    });
  });

  it("lists at most MAX_EMAIL_ITEMS and counts the rest", async () => {
    const rows = Array.from({ length: MAX_EMAIL_ITEMS + 4 }, () => claimed({ recipient_id: TOM }));
    const { admin } = fakeAdmin([rows]);
    await sendNotificationDigests({ admin, now: new Date("2026-11-07T06:05:00Z"), siteUrl: SITE });
    expect((h.sent[0].params.items as unknown[]).length).toBe(MAX_EMAIL_ITEMS);
    expect(h.sent[0].params.more).toBe(4);
  });

  it("a later run finds nothing to digest and sends nothing; without a site URL nothing is claimed", async () => {
    const { admin } = fakeAdmin([[]]);
    expect(await sendNotificationDigests({ admin, now: new Date("2026-11-07T09:00:00Z"), siteUrl: SITE })).toEqual({
      claimed: 0,
      recipients: 0,
      emailed: 0,
    });
    const off = fakeAdmin([[claimed({})]]);
    await sendNotificationDigests({ admin: off.admin, siteUrl: null });
    expect(off.rpcCalls).toEqual([]);
    expect(h.sent).toEqual([]);
  });
});

describe("the digest template's extras", () => {
  it("'and N more', the settings link, and the batch subject override, in both languages", () => {
    const params = {
      siteUrl: SITE,
      items: [{ title: "New site photo" }],
      linkUrl: `${SITE}/projects/p1`,
      more: 3,
      manageUrl: `${SITE}/settings/notifications`,
    };
    const en = renderDigestEmail(params, "en");
    expect(en.subject).toBe("Your RenoVision digest");
    expect(en.text).toContain("And 3 more in the app.");
    expect(en.html).toContain(`Choose what RenoVision emails you: ${SITE}/settings/notifications`);
    const pl = renderDigestEmail({ ...params, subject: "<b>2</b> nowe", heading: "Nowości" }, "pl");
    expect(pl.subject).toBe("<b>2</b> nowe");
    expect(pl.html).toContain("Nowości");
    expect(pl.html).toContain("I jeszcze 3 w aplikacji.");
    expect(renderDigestEmail({ ...params, heading: "<script>x</script>" }, "en").html).not.toContain("<script>x</script>");
  });
});

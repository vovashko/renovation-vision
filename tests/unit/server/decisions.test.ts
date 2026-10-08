// The investor-decision server functions (#55): the confirmation code (generation, hashing, never stored or
// logged in clear), issuing it by email, accepting through the RPC, submitting a case with the investor
// email, and the role gates. Handler bodies are tested directly (the media-delete.test.ts pattern).
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServerFnError } from "@/server/errors";
import type { AuthContext } from "@/server/middleware/auth";
import { runServerMiddleware } from "./run-middleware";

const PROJECT_ID = "b0000000-0000-4000-8000-000000000001";
const DECISION_ID = "d0000000-0000-4000-8000-000000000001";
const USER_ID = "a0000000-0000-4000-8000-000000000002";

const h = vi.hoisted(() => ({
  headers: {} as Record<string, string>,
  projectRoles: {} as Record<string, boolean>,
  sent: [] as { to: string; template: string; locale: string; params: Record<string, unknown> }[],
  sendError: undefined as Error | undefined,
  admin: undefined as unknown,
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => h.headers[name.toLowerCase()],
  getRequestUrl: () => new URL("https://app.renovision.test/projects/x/decisions"),
  getCookies: () => ({}),
  setCookie: () => {},
}));

vi.mock("@/lib/supabase/server", () => ({
  getJwtVerifier: () => ({
    auth: {
      getClaims: async () => ({
        data: { claims: { sub: USER_ID, role: "authenticated", email: "sarah@renovision.demo", aal: "aal1" } },
        error: null,
      }),
    },
  }),
  createServerSupabase: () => ({
    rpc: async (fn: string, args: { p_project: string }) => ({ data: h.projectRoles[`${fn}:${args.p_project}`] ?? false, error: null }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({ getAdminSupabase: () => h.admin }));

vi.mock("@/server/email/send-email.server", () => ({
  sendEmail: async (input: { to: string; template: string; locale: string; params: Record<string, unknown> }) => {
    if (h.sendError) throw h.sendError;
    h.sent.push(input);
  },
}));

const {
  generateCode,
  generateSalt,
  hashCode,
  requestDecisionCodeHandler,
  acceptDecisionHandler,
  createDecisionHandler,
  decisionRpcError,
  CODE_TTL_MINUTES,
} = await import("@/server/functions/decisions.server");
const { requireProjectRole } = await import("@/server/middleware/auth");

const logged: string[] = [];

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  h.headers = { authorization: "Bearer good.access.token" };
  h.projectRoles = {};
  h.sent = [];
  h.sendError = undefined;
  logged.length = 0;
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(" ")));
  }
});

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

describe("generateCode / generateSalt / hashCode", () => {
  it("makes 6-digit codes, keeping leading zeros", () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation(((buffer: Uint32Array) => {
      buffer[0] = 42;
      return buffer;
    }) as typeof crypto.getRandomValues);
    expect(generateCode()).toBe("000042");
    vi.restoreAllMocks();
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it("rejects values from the biased tail instead of taking a modulo", () => {
    const values = [4294967295, 123456];
    vi.spyOn(crypto, "getRandomValues").mockImplementation(((buffer: Uint32Array) => {
      buffer[0] = values.shift()!;
      return buffer;
    }) as typeof crypto.getRandomValues);
    expect(generateCode()).toBe("123456");
    expect(values).toEqual([]);
  });

  it("makes a fresh 32-hex-character salt each time", () => {
    const a = generateSalt();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(generateSalt()).not.toBe(a);
  });

  it("hashes sha256(salt:code) as hex: exactly what accept_decision computes in SQL", async () => {
    expect(await hashCode("abc", "123456")).toBe(sha256("abc:123456"));
    expect(await hashCode("abc", "123456")).not.toBe(await hashCode("abd", "123456"));
  });
});

/** A fake user client: `.from(table).select().eq().eq().maybeSingle()` returns `rows[table]`; `rpc` records its call. */
function fakeUserClient(opts: { rows?: Record<string, unknown>; rpc?: { data?: unknown; error?: unknown } } = {}) {
  const rpcCalls: { fn: string; args: unknown }[] = [];
  const chain = (table: string) => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: opts.rows?.[table] ?? null, error: null }),
    };
    return q;
  };
  return {
    client: {
      from: chain,
      rpc: async (fn: string, args: unknown) => {
        rpcCalls.push({ fn, args });
        return { data: opts.rpc?.data ?? null, error: opts.rpc?.error ?? null };
      },
    },
    rpcCalls,
  };
}

function contextWith(client: unknown, email: string | null = "sarah@renovision.demo"): AuthContext {
  return { user: { id: USER_ID, email, aal: "aal1", role: "authenticated" }, supabase: client } as unknown as AuthContext;
}

/** A fake admin client for requestDecisionCode: records the inserted confirmation and the void update. */
function fakeAdminForCodes(opts: { insertError?: { code: string; message: string } } = {}) {
  const inserted: Record<string, unknown>[] = [];
  const voided: string[] = [];
  h.admin = {
    from: (table: string) => {
      expect(table).toBe("decision_confirmations");
      return {
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              if (opts.insertError) return { data: null, error: opts.insertError };
              inserted.push(row);
              return { data: { id: "conf-1" }, error: null };
            },
          }),
        }),
        update: (patch: { consumed_at: string }) => ({
          eq: async (_column: string, id: string) => {
            expect(patch.consumed_at).toBeTruthy();
            voided.push(id);
            return { error: null };
          },
        }),
      };
    },
  };
  return { inserted, voided };
}

describe("requestDecisionCodeHandler", () => {
  const rows = { decisions: { id: DECISION_ID, title: "Extra socket", status: "pending" }, profiles: { locale: "pl" } };

  it("stores only the salted hash, emails the code to the signed-in user in their language, and never logs the code", async () => {
    const { client } = fakeUserClient({ rows });
    const { inserted } = fakeAdminForCodes();
    const result = await requestDecisionCodeHandler({ projectId: PROJECT_ID, decisionId: DECISION_ID }, contextWith(client));

    expect(result).toEqual({ ok: true, expiresInMinutes: CODE_TTL_MINUTES });
    expect(h.sent).toHaveLength(1);
    const mail = h.sent[0];
    expect(mail).toMatchObject({ to: "sarah@renovision.demo", template: "confirmationCode", locale: "pl" });
    const code = String(mail.params.code);
    expect(code).toMatch(/^\d{6}$/);
    expect(mail.params).toMatchObject({ siteUrl: "https://app.renovision.test", title: "Extra socket", ttlMinutes: 10 });

    expect(inserted).toHaveLength(1);
    const row = inserted[0];
    expect(row).toMatchObject({ decision_id: DECISION_ID, user_id: USER_ID });
    expect(row).not.toHaveProperty("code");
    expect(row.code_hash).toBe(sha256(`${String(row.salt)}:${code}`));
    expect(row.code_hash).not.toBe(code);
    const ttlMs = new Date(String(row.expires_at)).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(9 * 60_000);
    expect(ttlMs).toBeLessThanOrEqual(10 * 60_000);

    expect(logged.join("\n")).not.toContain(code);
  });

  it("404s when the user can't see the case (RLS)", async () => {
    const { client } = fakeUserClient({ rows: {} });
    fakeAdminForCodes();
    await expect(requestDecisionCodeHandler({ projectId: PROJECT_ID, decisionId: DECISION_ID }, contextWith(client))).rejects.toMatchObject(
      {
        code: "NOT_FOUND",
      },
    );
    expect(h.sent).toEqual([]);
  });

  it("refuses a case that is already decided", async () => {
    const { client } = fakeUserClient({ rows: { decisions: { id: DECISION_ID, title: "x", status: "accepted" } } });
    const { inserted } = fakeAdminForCodes();
    await expect(requestDecisionCodeHandler({ projectId: PROJECT_ID, decisionId: DECISION_ID }, contextWith(client))).rejects.toMatchObject(
      {
        code: "BAD_REQUEST",
        reason: "decision_not_open",
      },
    );
    expect(inserted).toEqual([]);
  });

  it("needs an email address to send to", async () => {
    const { client } = fakeUserClient({ rows });
    const { inserted } = fakeAdminForCodes();
    await expect(
      requestDecisionCodeHandler({ projectId: PROJECT_ID, decisionId: DECISION_ID }, contextWith(client, null)),
    ).rejects.toMatchObject({
      reason: "no_email",
    });
    expect(inserted).toEqual([]);
  });

  it("turns the database's hourly cap into a 429 with a reason", async () => {
    const { client } = fakeUserClient({ rows });
    fakeAdminForCodes({ insertError: { code: "54000", message: "Too many confirmation codes requested" } });
    const error = await requestDecisionCodeHandler({ projectId: PROJECT_ID, decisionId: DECISION_ID }, contextWith(client)).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ServerFnError);
    expect(error).toMatchObject({ code: "RATE_LIMITED", reason: "too_many_codes" });
    expect(h.sent).toEqual([]);
  });

  it("voids the code when the email can't be sent, so nobody holds an unreachable code", async () => {
    const { client } = fakeUserClient({ rows });
    const { voided } = fakeAdminForCodes();
    h.sendError = new ServerFnError("INTERNAL", "Failed to send email");
    await expect(requestDecisionCodeHandler({ projectId: PROJECT_ID, decisionId: DECISION_ID }, contextWith(client))).rejects.toMatchObject(
      {
        code: "INTERNAL",
      },
    );
    expect(voided).toEqual(["conf-1"]);
  });
});

describe("acceptDecisionHandler", () => {
  it("hands the code to the database and returns its verdict", async () => {
    for (const result of ["ok", "invalid_code", "expired", "already_accepted"]) {
      const { client, rpcCalls } = fakeUserClient({ rpc: { data: result } });
      await expect(
        acceptDecisionHandler({ projectId: PROJECT_ID, decisionId: DECISION_ID, code: "123456" }, contextWith(client)),
      ).resolves.toEqual({ result });
      expect(rpcCalls).toEqual([{ fn: "accept_decision", args: { p_decision: DECISION_ID, p_code: "123456" } }]);
    }
  });

  it("maps a refused budget and a foreign case to stable errors", async () => {
    const budget = fakeUserClient({
      rpc: { error: { code: "23514", hint: "budget_negative", message: "The budget can't drop below zero" } },
    });
    await expect(
      acceptDecisionHandler({ projectId: PROJECT_ID, decisionId: DECISION_ID, code: "123456" }, contextWith(budget.client)),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", reason: "budget_negative" });

    const forbidden = fakeUserClient({ rpc: { error: { code: "42501", message: "nope" } } });
    await expect(
      acceptDecisionHandler({ projectId: PROJECT_ID, decisionId: DECISION_ID, code: "123456" }, contextWith(forbidden.client)),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("never logs the code", async () => {
    const { client } = fakeUserClient({ rpc: { data: "invalid_code" } });
    await acceptDecisionHandler({ projectId: PROJECT_ID, decisionId: DECISION_ID, code: "654321" }, contextWith(client));
    expect(logged.join("\n")).not.toContain("654321");
  });
});

describe("decisionRpcError", () => {
  it("leaves unexpected errors as plain errors (logged and shown as a generic 500)", () => {
    const error = decisionRpcError({ code: "XX000", message: "boom" });
    expect(error).not.toBeInstanceOf(ServerFnError);
    expect(error.message).toBe("boom");
  });
});

describe("createDecisionHandler", () => {
  const input = {
    projectId: PROJECT_ID,
    title: "Cheaper tiles",
    description: "",
    costDelta: -1200.5,
    daysDelta: -3,
    photos: [`${PROJECT_ID}/decisions/a.jpg`],
  };

  /** Admin client: two investors (one Polish, one English, one without an email). */
  function fakeAdminForEmails() {
    const emails: Record<string, string | null> = { u1: "sarah@renovision.demo", u2: "tom@renovision.demo", u3: null };
    const locales: Record<string, string> = { u1: "pl", u2: "en" };
    h.admin = {
      from: (table: string) => {
        let id = "";
        const q: Record<string, unknown> = {
          select: () => q,
          eq: (column: string, value: string) => {
            if (column === "id") id = value;
            return q;
          },
          maybeSingle: async () => ({ data: { locale: locales[id] ?? "pl" }, error: null }),
          then: (resolve: (v: unknown) => unknown) =>
            resolve({ data: table === "project_members" ? [{ user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }] : null, error: null }),
        };
        return q;
      },
      auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: emails[id] } }, error: null }) } },
    };
  }

  it("submits through the RPC, then emails each investor that has an address, in their language", async () => {
    fakeAdminForEmails();
    const { client, rpcCalls } = fakeUserClient({ rpc: { data: DECISION_ID } });
    await expect(createDecisionHandler(input, contextWith(client))).resolves.toEqual({ id: DECISION_ID });
    expect(rpcCalls).toEqual([
      {
        fn: "create_decision",
        args: {
          p_project: PROJECT_ID,
          p_title: "Cheaper tiles",
          p_description: "",
          p_cost_delta: -1200.5,
          p_days_delta: -3,
          p_photos: input.photos,
        },
      },
    ]);
    expect(h.sent.map((m) => [m.to, m.locale, m.template])).toEqual([
      ["sarah@renovision.demo", "pl", "notification"],
      ["tom@renovision.demo", "en", "notification"],
    ]);
    expect(h.sent[0].params).toMatchObject({
      linkUrl: `https://app.renovision.test/projects/${PROJECT_ID}/decisions`,
      title: expect.stringContaining("Cheaper tiles"),
    });
  });

  it("keeps the case when the investor email fails (it is only logged)", async () => {
    fakeAdminForEmails();
    h.sendError = new Error("brevo down");
    const { client } = fakeUserClient({ rpc: { data: DECISION_ID } });
    await expect(createDecisionHandler(input, contextWith(client))).resolves.toEqual({ id: DECISION_ID });
  });

  it("sends nothing and reports a stable reason when the database refuses the case", async () => {
    fakeAdminForEmails();
    const { client } = fakeUserClient({
      rpc: { error: { code: "22023", hint: "photos_required", message: "A decision needs at least one photo" } },
    });
    await expect(createDecisionHandler(input, contextWith(client))).rejects.toMatchObject({
      code: "BAD_REQUEST",
      reason: "photos_required",
    });
    expect(h.sent).toEqual([]);
  });
});

// createDecision requires a manager of the project; requestDecisionCode / acceptDecision a client (the investor).
describe("the role gates of the decision server functions", () => {
  const managerOnly = requireProjectRole((input: { projectId: string }) => input.projectId, "manager");
  const clientOnly = requireProjectRole((input: { projectId: string }) => input.projectId, "client");

  it("createDecision: a client is refused, a manager passes", async () => {
    h.projectRoles[`is_project_manager:${PROJECT_ID}`] = false;
    await expect(runServerMiddleware([managerOnly], { data: { projectId: PROJECT_ID } })).rejects.toMatchObject({
      status: 403,
      reason: "project_manager_required",
    });
    h.projectRoles[`is_project_manager:${PROJECT_ID}`] = true;
    expect((await runServerMiddleware([managerOnly], { data: { projectId: PROJECT_ID } })).handlerCalled).toBe(true);
  });

  it("requestDecisionCode / acceptDecision: a manager is refused, the investor passes", async () => {
    h.projectRoles[`is_project_client:${PROJECT_ID}`] = false;
    await expect(runServerMiddleware([clientOnly], { data: { projectId: PROJECT_ID } })).rejects.toMatchObject({
      status: 403,
      reason: "project_client_required",
    });
    h.projectRoles[`is_project_client:${PROJECT_ID}`] = true;
    expect((await runServerMiddleware([clientOnly], { data: { projectId: PROJECT_ID } })).handlerCalled).toBe(true);
  });
});

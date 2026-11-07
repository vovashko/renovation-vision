// The change-request server functions (T61): submitting through the RPC with the clients' email, approving with
// the managers' email, the error mapping and the role gates. Handler bodies are tested directly (the
// media-delete.test.ts pattern).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServerFnError } from "@/server/errors";
import type { AuthContext } from "@/server/middleware/auth";
import { runServerMiddleware } from "./run-middleware";

const PROJECT_ID = "b0000000-0000-4000-8000-000000000001";
const REQUEST_ID = "d0000000-0000-4000-8000-000000000001";
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
  getRequestUrl: () => new URL("https://app.renovision.test/projects/x/budget"),
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

const { acceptChangeRequestHandler, createChangeRequestHandler, changeRequestRpcError, requestLink } =
  await import("@/server/functions/decisions.server");
const { requireProjectRole } = await import("@/server/middleware/auth");

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  h.headers = { authorization: "Bearer good.access.token" };
  h.projectRoles = {};
  h.sent = [];
  h.sendError = undefined;
  for (const level of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => {});
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

function contextWith(client: unknown): AuthContext {
  return {
    user: { id: USER_ID, email: "sarah@renovision.demo", aal: "aal1", role: "authenticated" },
    supabase: client,
  } as unknown as AuthContext;
}

/** Admin client: the members of a role (one Polish, one English, one without an email). */
function fakeAdminForEmails() {
  const emails: Record<string, string | null> = { u1: "sarah@renovision.demo", u2: "tom@renovision.demo", u3: null };
  const locales: Record<string, string> = { u1: "pl", u2: "en" };
  const memberQueries: Record<string, unknown>[] = [];
  h.admin = {
    from: (table: string) => {
      let id = "";
      const filters: Record<string, unknown> = {};
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (column: string, value: string) => {
          filters[column] = value;
          if (column === "id") id = value;
          return q;
        },
        maybeSingle: async () => ({ data: { locale: locales[id] ?? "pl" }, error: null }),
        then: (resolve: (v: unknown) => unknown) => {
          if (table === "project_members") memberQueries.push(filters);
          return resolve({
            data: table === "project_members" ? [{ user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }] : null,
            error: null,
          });
        },
      };
      return q;
    },
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: emails[id] } }, error: null }) } },
  };
  return { memberQueries };
}

describe("createChangeRequestHandler", () => {
  const input = { projectId: PROJECT_ID, title: "Cheaper tiles", description: "", costDelta: -1200.5, daysDelta: -3, stageId: null };

  it("submits through the RPC (no photos), then emails each client that has an address, in their language", async () => {
    const { memberQueries } = fakeAdminForEmails();
    const { client, rpcCalls } = fakeUserClient({ rpc: { data: REQUEST_ID } });
    await expect(createChangeRequestHandler(input, contextWith(client))).resolves.toEqual({ id: REQUEST_ID });
    expect(rpcCalls).toEqual([
      {
        fn: "create_decision",
        args: {
          p_project: PROJECT_ID,
          p_title: "Cheaper tiles",
          p_description: "",
          p_cost_delta: -1200.5,
          p_days_delta: -3,
          p_stage: undefined,
        },
      },
    ]);
    expect(memberQueries[0]).toMatchObject({ project_id: PROJECT_ID, role: "client" });
    expect(h.sent.map((m) => [m.to, m.locale, m.template])).toEqual([
      ["sarah@renovision.demo", "pl", "notification"],
      ["tom@renovision.demo", "en", "notification"],
    ]);
    expect(h.sent[0].params).toMatchObject({
      linkUrl: `https://app.renovision.test/projects/${PROJECT_ID}/budget?request=${REQUEST_ID}`,
      title: expect.stringContaining("Cheaper tiles"),
    });
    expect(String(h.sent[1].params.title)).toBe("A change request needs your approval: Cheaper tiles");
  });

  it("passes the stage, and links a days-only request to Progress", async () => {
    fakeAdminForEmails();
    const { client, rpcCalls } = fakeUserClient({ rpc: { data: REQUEST_ID } });
    await createChangeRequestHandler({ ...input, costDelta: 0, daysDelta: 2, stageId: "s1" }, contextWith(client));
    expect(rpcCalls[0].args).toMatchObject({ p_stage: "s1" });
    expect(h.sent[0].params.linkUrl).toBe(`https://app.renovision.test/projects/${PROJECT_ID}/progress?request=${REQUEST_ID}`);
  });

  it("keeps the request when the client email fails (it is only logged)", async () => {
    fakeAdminForEmails();
    h.sendError = new Error("brevo down");
    const { client } = fakeUserClient({ rpc: { data: REQUEST_ID } });
    await expect(createChangeRequestHandler(input, contextWith(client))).resolves.toEqual({ id: REQUEST_ID });
  });

  it("sends nothing and reports a stable reason when the database refuses the request", async () => {
    fakeAdminForEmails();
    const noChange = fakeUserClient({ rpc: { error: { code: "22023", hint: "no_change", message: "must change" } } });
    await expect(createChangeRequestHandler(input, contextWith(noChange.client))).rejects.toMatchObject({
      code: "BAD_REQUEST",
      reason: "no_change",
    });
    const mfa = fakeUserClient({ rpc: { error: { code: "42501", hint: "mfa_required", message: "2FA" } } });
    await expect(createChangeRequestHandler(input, contextWith(mfa.client))).rejects.toMatchObject({
      code: "FORBIDDEN",
      reason: "mfa_required",
    });
    expect(h.sent).toEqual([]);
  });
});

describe("acceptChangeRequestHandler", () => {
  const rows = { decisions: { id: REQUEST_ID, title: "Extra socket", cost_delta: "880.00", days_delta: 0 } };

  it("approves through the RPC without a code, then emails the managers", async () => {
    const { memberQueries } = fakeAdminForEmails();
    const { client, rpcCalls } = fakeUserClient({ rows, rpc: { data: "ok" } });
    await expect(acceptChangeRequestHandler({ projectId: PROJECT_ID, requestId: REQUEST_ID }, contextWith(client))).resolves.toEqual({
      result: "ok",
    });
    expect(rpcCalls).toEqual([{ fn: "accept_decision", args: { p_decision: REQUEST_ID } }]);
    expect(memberQueries[0]).toMatchObject({ role: "manager" });
    expect(h.sent).toHaveLength(2);
    expect(String(h.sent[1].params.title)).toBe("Change request approved: Extra socket");
  });

  it("a repeated approve returns already_accepted and emails nobody", async () => {
    fakeAdminForEmails();
    const { client } = fakeUserClient({ rows, rpc: { data: "already_accepted" } });
    await expect(acceptChangeRequestHandler({ projectId: PROJECT_ID, requestId: REQUEST_ID }, contextWith(client))).resolves.toEqual({
      result: "already_accepted",
    });
    expect(h.sent).toEqual([]);
  });

  it("maps a refused budget and a foreign request to stable errors", async () => {
    const budget = fakeUserClient({ rpc: { error: { code: "23514", hint: "budget_negative", message: "below zero" } } });
    await expect(
      acceptChangeRequestHandler({ projectId: PROJECT_ID, requestId: REQUEST_ID }, contextWith(budget.client)),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      reason: "budget_negative",
    });
    const forbidden = fakeUserClient({ rpc: { error: { code: "42501", message: "nope" } } });
    await expect(
      acceptChangeRequestHandler({ projectId: PROJECT_ID, requestId: REQUEST_ID }, contextWith(forbidden.client)),
    ).rejects.toMatchObject({ code: "FORBIDDEN", reason: "decision_forbidden" });
  });
});

describe("changeRequestRpcError and requestLink", () => {
  it("leaves unexpected errors as plain errors (logged and shown as a generic 500)", () => {
    const error = changeRequestRpcError({ code: "XX000", message: "boom" });
    expect(error).not.toBeInstanceOf(ServerFnError);
    expect(error.message).toBe("boom");
  });

  it("links to where the request is listed", () => {
    expect(requestLink("https://x.test", "p1", { id: "r1", cost_delta: 5, days_delta: 2 })).toBe(
      "https://x.test/projects/p1/budget?request=r1",
    );
    expect(requestLink("https://x.test", "p1", { id: "r1", cost_delta: 0, days_delta: 2 })).toBe(
      "https://x.test/projects/p1/progress?request=r1",
    );
  });
});

// createChangeRequest requires a manager of the project; acceptChangeRequest a client.
describe("the role gates of the change-request server functions", () => {
  const managerOnly = requireProjectRole((input: { projectId: string }) => input.projectId, "manager");
  const clientOnly = requireProjectRole((input: { projectId: string }) => input.projectId, "client");

  it("createChangeRequest: a client is refused, a manager passes", async () => {
    h.projectRoles[`is_project_manager:${PROJECT_ID}`] = false;
    await expect(runServerMiddleware([managerOnly], { data: { projectId: PROJECT_ID } })).rejects.toMatchObject({
      status: 403,
      reason: "project_manager_required",
    });
    h.projectRoles[`is_project_manager:${PROJECT_ID}`] = true;
    expect((await runServerMiddleware([managerOnly], { data: { projectId: PROJECT_ID } })).handlerCalled).toBe(true);
  });

  it("acceptChangeRequest: a manager is refused, the client passes", async () => {
    h.projectRoles[`is_project_client:${PROJECT_ID}`] = false;
    await expect(runServerMiddleware([clientOnly], { data: { projectId: PROJECT_ID } })).rejects.toMatchObject({
      status: 403,
      reason: "project_client_required",
    });
    h.projectRoles[`is_project_client:${PROJECT_ID}`] = true;
    expect((await runServerMiddleware([clientOnly], { data: { projectId: PROJECT_ID } })).handlerCalled).toBe(true);
  });
});

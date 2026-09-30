import { beforeEach, describe, expect, it, vi } from "vitest";
import { runServerMiddleware } from "./run-middleware";

// The request (headers, cookies) and the Supabase clients are stubbed; the middleware logic is real.
const h = vi.hoisted(() => ({
  headers: {} as Record<string, string>,
  getClaims: vi.fn(),
  cookieSession: null as null | { access_token: string },
  accountType: "manager" as string | null,
  projectRoles: {} as Record<string, boolean>,
  clients: [] as { accessToken?: string }[],
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => h.headers[name.toLowerCase()],
  getCookies: () => ({}),
  setCookie: () => {},
  setResponseHeader: () => {},
}));

vi.mock("@/lib/supabase/server", () => ({
  getJwtVerifier: () => ({ auth: { getClaims: h.getClaims } }),
  createServerSupabase: (options: { accessToken?: string } = {}) => {
    const client = {
      accessToken: options.accessToken,
      auth: { getSession: async () => ({ data: { session: h.cookieSession }, error: null }) },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.accountType ? { account_type: h.accountType } : null, error: null }) }) }),
      }),
      rpc: async (fn: string, args: { p_project: string }) => ({ data: h.projectRoles[`${fn}:${args.p_project}`] ?? false, error: null }),
    };
    h.clients.push(client);
    return client;
  },
}));

const { requireUser, requireAal2, requireAccountType, requireProjectRole } = await import("@/server/middleware/auth");
const { ServerFnError } = await import("@/server/errors");
const { parseBearer, userFromClaims } = await import("@/server/auth.server");

const USER_ID = "a0000000-0000-4000-8000-000000000001";
const PROJECT_ID = "b0000000-0000-4000-8000-000000000001";
const claims = (extra: Record<string, unknown> = {}) => ({ sub: USER_ID, role: "authenticated", email: "jonas@renovision.demo", aal: "aal1", ...extra });
const invalidJwt = (message: string) => ({ data: null, error: Object.assign(new Error(message), { name: "AuthInvalidJwtError", status: 400 }) });

async function expectServerError(promise: Promise<unknown>, status: number, code: string, reason?: string) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ServerFnError);
  expect(error).toMatchObject({ status, code, ...(reason ? { reason } : {}) });
  return error as InstanceType<typeof ServerFnError>;
}

beforeEach(() => {
  h.headers = {};
  h.getClaims.mockReset();
  h.cookieSession = null;
  h.accountType = "manager";
  h.projectRoles = {};
  h.clients = [];
});

describe("requireUser", () => {
  it("401s without an Authorization header or a cookie session", async () => {
    const error = await expectServerError(runServerMiddleware([requireUser]), 401, "UNAUTHORIZED", "missing_token");
    expect(error.toBody("req-1")).toEqual({ error: { code: "UNAUTHORIZED", message: "Missing access token", requestId: "req-1", reason: "missing_token" } });
    expect(h.getClaims).not.toHaveBeenCalled();
  });

  it("401s on a malformed Authorization header without calling Supabase", async () => {
    h.headers.authorization = "Basic dXNlcjpwYXNz";
    await expectServerError(runServerMiddleware([requireUser]), 401, "UNAUTHORIZED", "invalid_token");
    h.headers.authorization = "Bearer two words";
    await expectServerError(runServerMiddleware([requireUser]), 401, "UNAUTHORIZED", "invalid_token");
    expect(h.getClaims).not.toHaveBeenCalled();
  });

  it("401s when getClaims rejects the token (garbage, expired or bad signature)", async () => {
    h.headers.authorization = "Bearer not.a.jwt";
    h.getClaims.mockResolvedValue(invalidJwt("Invalid JWT structure"));
    await expectServerError(runServerMiddleware([requireUser]), 401, "UNAUTHORIZED", "invalid_token");

    h.getClaims.mockResolvedValue(invalidJwt("JWT has expired"));
    await expectServerError(runServerMiddleware([requireUser]), 401, "UNAUTHORIZED", "invalid_token");
    expect(h.getClaims).toHaveBeenCalledWith("not.a.jwt");
  });

  it("503s (not 401) when the JWKS/Auth endpoint can't be reached", async () => {
    h.headers.authorization = "Bearer some.valid.looking";
    h.getClaims.mockResolvedValue({ data: null, error: Object.assign(new Error("fetch failed"), { name: "AuthRetryableFetchError", status: 0 }) });
    await expectServerError(runServerMiddleware([requireUser]), 503, "UNAVAILABLE");
  });

  it("401s on verified claims that aren't a signed-in user (anon role, anonymous sign-in)", async () => {
    h.headers.authorization = "Bearer some.valid.looking";
    h.getClaims.mockResolvedValue({ data: { claims: claims({ role: "anon" }) }, error: null });
    await expectServerError(runServerMiddleware([requireUser]), 401, "UNAUTHORIZED");
    h.getClaims.mockResolvedValue({ data: { claims: claims({ is_anonymous: true }) }, error: null });
    await expectServerError(runServerMiddleware([requireUser]), 401, "UNAUTHORIZED");
  });

  it("puts the user and a Supabase client acting as that user in the context", async () => {
    h.headers.authorization = "Bearer good.access.token";
    h.getClaims.mockResolvedValue({ data: { claims: claims() }, error: null });
    const { context, handlerCalled } = await runServerMiddleware([requireUser]);
    expect(handlerCalled).toBe(true);
    expect(context.user).toEqual({ id: USER_ID, email: "jonas@renovision.demo", aal: "aal1", role: "authenticated" });
    expect(context.supabase).toBe(h.clients[0]);
    expect(h.clients[0].accessToken).toBe("good.access.token");
  });

  it("falls back to the cookie session when there is no Authorization header, and still verifies it", async () => {
    h.cookieSession = { access_token: "cookie.access.token" };
    h.getClaims.mockResolvedValue({ data: { claims: claims() }, error: null });
    const { context } = await runServerMiddleware([requireUser]);
    expect(h.getClaims).toHaveBeenCalledWith("cookie.access.token");
    expect((context.user as { id: string }).id).toBe(USER_ID);
    expect(context.supabase).toBe(h.clients[0]);
    expect(h.clients[0].accessToken).toBeUndefined(); // the cookie-backed client

    h.getClaims.mockResolvedValue(invalidJwt("Invalid JWT signature"));
    await expectServerError(runServerMiddleware([requireUser]), 401, "UNAUTHORIZED", "invalid_token");
  });
});

describe("requireAal2", () => {
  beforeEach(() => {
    h.headers.authorization = "Bearer good.access.token";
  });

  it("403s an aal1 session with reason aal2_required", async () => {
    h.getClaims.mockResolvedValue({ data: { claims: claims({ aal: "aal1" }) }, error: null });
    await expectServerError(runServerMiddleware([requireAal2]), 403, "FORBIDDEN", "aal2_required");
  });

  it("lets an aal2 session through", async () => {
    h.getClaims.mockResolvedValue({ data: { claims: claims({ aal: "aal2" }) }, error: null });
    const { handlerCalled, context } = await runServerMiddleware([requireAal2]);
    expect(handlerCalled).toBe(true);
    expect((context.user as { aal: string }).aal).toBe("aal2");
  });

  it("still 401s first when there is no user", async () => {
    delete h.headers.authorization;
    await expectServerError(runServerMiddleware([requireAal2]), 401, "UNAUTHORIZED");
  });
});

describe("requireAccountType", () => {
  beforeEach(() => {
    h.headers.authorization = "Bearer good.access.token";
    h.getClaims.mockResolvedValue({ data: { claims: claims() }, error: null });
  });

  it("403s the wrong account type", async () => {
    h.accountType = "client";
    await expectServerError(runServerMiddleware([requireAccountType("manager")]), 403, "FORBIDDEN", "account_type_manager_required");
  });

  it("403s a user without a profile", async () => {
    h.accountType = null;
    await expectServerError(runServerMiddleware([requireAccountType("manager", "client")]), 403, "FORBIDDEN");
  });

  it("passes the right account type and adds it to the context", async () => {
    const { handlerCalled, context } = await runServerMiddleware([requireAccountType("manager")]);
    expect(handlerCalled).toBe(true);
    expect(context.accountType).toBe("manager");
  });
});

describe("requireProjectRole", () => {
  beforeEach(() => {
    h.headers.authorization = "Bearer good.access.token";
    h.getClaims.mockResolvedValue({ data: { claims: claims() }, error: null });
  });

  const managerOnly = requireProjectRole((input: { projectId: string }) => input.projectId, "manager");
  const anyMember = requireProjectRole((input: { projectId: string }) => input.projectId, "member");

  it("403s a non-member", async () => {
    await expectServerError(runServerMiddleware([anyMember], { data: { projectId: PROJECT_ID } }), 403, "FORBIDDEN", "project_member_required");
  });

  it("403s a member without the required role", async () => {
    h.projectRoles[`is_project_member:${PROJECT_ID}`] = true;
    h.projectRoles[`is_project_manager:${PROJECT_ID}`] = false;
    await expectServerError(runServerMiddleware([managerOnly], { data: { projectId: PROJECT_ID } }), 403, "FORBIDDEN", "project_manager_required");
  });

  it("passes a member (and a manager for the manager check) and adds projectId to the context", async () => {
    h.projectRoles[`is_project_member:${PROJECT_ID}`] = true;
    h.projectRoles[`is_project_manager:${PROJECT_ID}`] = true;
    const member = await runServerMiddleware([anyMember], { data: { projectId: PROJECT_ID } });
    expect(member.handlerCalled).toBe(true);
    expect(member.context.projectId).toBe(PROJECT_ID);
    const manager = await runServerMiddleware([managerOnly], { data: { projectId: PROJECT_ID } });
    expect(manager.handlerCalled).toBe(true);
  });

  it("400s when the picked project id isn't a UUID (the raw input is untrusted)", async () => {
    await expectServerError(runServerMiddleware([anyMember], { data: { projectId: "1 or 1=1" } }), 400, "BAD_REQUEST");
    await expectServerError(runServerMiddleware([anyMember], { data: undefined }), 400, "BAD_REQUEST");
  });

  it("composes: aal2 + account type + project role run requireUser once", async () => {
    h.getClaims.mockResolvedValue({ data: { claims: claims({ aal: "aal2" }) }, error: null });
    h.projectRoles[`is_project_manager:${PROJECT_ID}`] = true;
    const { handlerCalled, context } = await runServerMiddleware([requireUser, requireAal2, requireAccountType("manager"), managerOnly], {
      data: { projectId: PROJECT_ID },
    });
    expect(handlerCalled).toBe(true);
    expect(context).toMatchObject({ accountType: "manager", projectId: PROJECT_ID });
    expect(h.getClaims).toHaveBeenCalledTimes(1);
  });
});

describe("pure helpers", () => {
  it("parseBearer", () => {
    expect(parseBearer(undefined)).toBeUndefined();
    expect(parseBearer("  ")).toBeUndefined();
    expect(parseBearer("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(parseBearer("bearer abc")).toBe("abc");
    expect(() => parseBearer("Token abc")).toThrow(ServerFnError);
  });

  it("userFromClaims defaults aal to aal1 and a missing email to null", () => {
    expect(userFromClaims({ sub: USER_ID, role: "authenticated" })).toEqual({ id: USER_ID, email: null, aal: "aal1", role: "authenticated" });
    expect(() => userFromClaims({ role: "authenticated" })).toThrow(ServerFnError);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// The request's cookies and the Supabase clients are stubbed; getSession's logic (loadSession) and
// the token verification (authenticateRequest → getClaims) are real.
const h = vi.hoisted(() => ({
  cookieSession: null as null | { access_token: string },
  getClaims: vi.fn(),
  profile: null as null | Record<string, unknown>,
  profileQuery: [] as unknown[],
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: () => "Bearer header-token-that-must-be-ignored",
  getCookies: () => ({}),
  setCookie: () => {},
}));

vi.mock("@/lib/supabase/server", () => ({
  getJwtVerifier: () => ({ auth: { getClaims: h.getClaims } }),
  createServerSupabase: () => ({
    auth: { getSession: async () => ({ data: { session: h.cookieSession }, error: null }) },
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => ({
          maybeSingle: async () => {
            h.profileQuery = [table, columns, column, value];
            return { data: h.profile, error: null };
          },
        }),
      }),
    }),
  }),
}));

const { loadSession } = await import("@/server/functions/session.server");

const USER_ID = "a0000000-0000-4000-8000-000000000001";

beforeEach(() => {
  h.cookieSession = null;
  h.getClaims.mockReset();
  h.profile = null;
  h.profileQuery = [];
});

describe("getSession (loadSession)", () => {
  it("is signed out (not a 401) without a session cookie", async () => {
    await expect(loadSession()).resolves.toEqual({ user: null, profile: null });
    expect(h.getClaims).not.toHaveBeenCalled();
  });

  it("is signed out when the cookie's token fails verification", async () => {
    h.cookieSession = { access_token: "forged" };
    h.getClaims.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("bad signature"), { name: "AuthInvalidJwtError", status: 400 }),
    });
    await expect(loadSession()).resolves.toEqual({ user: null, profile: null });
    expect(h.getClaims).toHaveBeenCalledWith("forged");
  });

  it("is signed out for an anonymous session", async () => {
    h.cookieSession = { access_token: "anon" };
    h.getClaims.mockResolvedValue({ data: { claims: { sub: USER_ID, role: "authenticated", is_anonymous: true } }, error: null });
    await expect(loadSession()).resolves.toEqual({ user: null, profile: null });
  });

  it("returns the verified user and their profile for a valid cookie, ignoring any Authorization header", async () => {
    h.cookieSession = { access_token: "cookie-token" };
    h.getClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID, role: "authenticated", email: "jonas@renovision.demo", aal: "aal1" } },
      error: null,
    });
    h.profile = { full_name: "Jonas Weber", avatar_url: null, account_type: "manager" };
    await expect(loadSession()).resolves.toEqual({
      user: { id: USER_ID, email: "jonas@renovision.demo", aal: "aal1" },
      profile: { full_name: "Jonas Weber", avatar_url: null, account_type: "manager" },
    });
    expect(h.getClaims).toHaveBeenCalledWith("cookie-token");
    expect(h.profileQuery).toEqual(["profiles", "full_name, avatar_url, account_type", "id", USER_ID]);
  });

  it("surfaces an unreachable Auth server instead of pretending the user is signed out", async () => {
    h.cookieSession = { access_token: "cookie-token" };
    h.getClaims.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("fetch failed"), { name: "AuthRetryableFetchError", status: 0 }),
    });
    await expect(loadSession()).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});

describe("the router's session store", () => {
  it("asks the server once, then serves the cached session until reset", async () => {
    vi.doMock("@/server/functions/session", () => ({ getSession: vi.fn() }));
    const { createSessionStore } = await import("@/lib/auth");
    const signedIn = { user: { id: USER_ID, email: null, aal: "aal1" as const }, profile: null };
    const fetchSession = vi.fn().mockResolvedValue(signedIn);
    const store = createSessionStore(fetchSession);
    const [a, b] = await Promise.all([store.load(), store.load()]);
    expect(a).toBe(signedIn);
    expect(b).toBe(signedIn);
    await store.load();
    expect(fetchSession).toHaveBeenCalledTimes(1);
    store.reset();
    fetchSession.mockResolvedValue({ user: null, profile: null });
    await expect(store.load()).resolves.toEqual({ user: null, profile: null });
    expect(fetchSession).toHaveBeenCalledTimes(2);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetWorkerEnv } from "../../stubs/cloudflare-workers";

// The server clients read cookies through TanStack Start's request helpers; outside a real request
// we stand them in with a plain cookie jar.
const jar = vi.hoisted(() => ({ cookies: {} as Record<string, string>, set: [] as { name: string; value: string }[] }));
vi.mock("@tanstack/react-start/server", () => ({
  getCookies: () => jar.cookies,
  setCookie: (name: string, value: string) => jar.set.push({ name, value }),
}));

const SECRET = ["sb", "secret", "not-a-real-key"].join("_");
const PUBLISHABLE = ["sb", "publishable", "not-a-real-key"].join("_");

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", PUBLISHABLE);
  jar.cookies = {};
  jar.set = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetWorkerEnv();
});

function stubFetch() {
  const fetchMock = vi.fn(async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("createServerSupabase", () => {
  it("with an access token, sends it as the Bearer token so RLS runs as that user", async () => {
    const fetchMock = stubFetch();
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const client = createServerSupabase({ accessToken: "user-jwt" });
    await client.from("profiles").select("id");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("http://127.0.0.1:54321/rest/v1/profiles");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer user-jwt");
    expect(headers.get("apikey")).toBe(PUBLISHABLE);
  });

  it("without a token, reads the session from the request cookies (none today → no session)", async () => {
    const { createServerSupabase } = await import("@/lib/supabase/server");
    jar.cookies = { unrelated: "1" };
    const client = createServerSupabase();
    const { data } = await client.auth.getSession();
    expect(data.session).toBeNull();
  });

  it("refuses to run with a secret key in the public env", async () => {
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", SECRET);
    const { createServerSupabase } = await import("@/lib/supabase/server");
    expect(() => createServerSupabase({ accessToken: "t" })).toThrow(/VITE_SUPABASE_PUBLISHABLE_KEY holds a secret key/);
  });

  it("getJwtVerifier is shared across requests (it holds the JWKS cache)", async () => {
    const { getJwtVerifier } = await import("@/lib/supabase/server");
    expect(getJwtVerifier()).toBe(getJwtVerifier());
  });
});

describe("getAdminSupabase", () => {
  it("fails with a clear message when SUPABASE_SECRET_KEY is missing", async () => {
    resetWorkerEnv({});
    const { getAdminSupabase } = await import("@/lib/supabase/admin");
    expect(() => getAdminSupabase()).toThrow(/SUPABASE_SECRET_KEY is not set/);
  });

  it("builds one cached client with the secret key", async () => {
    resetWorkerEnv({ SUPABASE_SECRET_KEY: SECRET });
    const fetchMock = stubFetch();
    const { getAdminSupabase } = await import("@/lib/supabase/admin");
    const admin = getAdminSupabase();
    expect(getAdminSupabase()).toBe(admin);
    await admin.from("profiles").select("id");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("apikey")).toBe(SECRET);
  });
});

import { describe, expect, it, vi } from "vitest";

// healthz.ts reads the Supabase URL/key via `@/lib/env`'s getPublicEnv(), which in turn reads
// `import.meta.env.VITE_SUPABASE_URL` — real in a dev/build checkout (.env.local), unset in CI.
// Mocked here (hoisted, like tests/unit/server/security-headers.test.ts) so this suite never
// depends on a local env file.
vi.mock("@/lib/env", () => ({ getPublicEnv: () => ({ url: "http://127.0.0.1:54321", key: "sb_publishable_x" }) }));

const { buildHealthResponse, checkSupabaseHealth } = await import("@/server/healthz");

describe("checkSupabaseHealth", () => {
  it("is ok when the Supabase health endpoint responds ok", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:54321/auth/v1/health");
      return new Response("ok", { status: 200 });
    });
    expect(await checkSupabaseHealth("http://127.0.0.1:54321", "sb_publishable_x", fetchImpl as unknown as typeof fetch)).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0];
    expect(init?.headers).toMatchObject({ apikey: "sb_publishable_x" });
  });

  it("is an error when the endpoint responds with a non-ok status", async () => {
    const fetchImpl = vi.fn(async () => new Response("down", { status: 500 }));
    expect(await checkSupabaseHealth("http://127.0.0.1:54321", "k", fetchImpl as unknown as typeof fetch)).toBe("error");
  });

  it("is an error when the fetch rejects", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await checkSupabaseHealth("http://127.0.0.1:54321", "k", fetchImpl as unknown as typeof fetch)).toBe("error");
  });

  it("is an error when the request doesn't settle before the timeout", async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    const result = await checkSupabaseHealth("http://127.0.0.1:54321", "k", fetchImpl as unknown as typeof fetch, 5);
    expect(result).toBe("error");
  });
});

describe("buildHealthResponse", () => {
  it("is 200 with ok checks when Supabase is healthy, and carries no-store + nosniff headers", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    const response = await buildHealthResponse(fetchImpl as unknown as typeof fetch);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-type")).toContain("application/json");
    // The helmet-equivalent headers (src/server/middleware/security-headers.ts) apply here too.
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, checks: { worker: "ok", supabase: "ok" } });
    expect(typeof body.version).toBe("string");
    expect(typeof body.time).toBe("string");
  });

  it("is 503 when Supabase is unreachable, and carries no PII", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const response = await buildHealthResponse(fetchImpl as unknown as typeof fetch);
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, checks: { worker: "ok", supabase: "error" } });
    expect(JSON.stringify(body)).not.toMatch(/@/); // no email, no key material
  });
});

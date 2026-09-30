import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetWorkerEnv } from "../../stubs/cloudflare-workers";
import { runServerMiddleware } from "./run-middleware";

const h = vi.hoisted(() => ({ headers: {} as Record<string, string>, lines: [] as string[] }));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: (name: string) => h.headers[name.toLowerCase()] }));

const { rateLimit } = await import("@/server/middleware/rate-limit");
const { checkRateLimit, resetMemoryRateLimiter } = await import("@/server/rate-limit.server");
const { RATE_LIMITS } = await import("@/server/rate-limits");
const { ServerFnError } = await import("@/server/errors");

const USER = { id: "a0000000-0000-4000-8000-000000000001" };

async function rejection(promise: Promise<unknown>) {
  return promise.then(
    () => undefined,
    (e: unknown) => e as InstanceType<typeof ServerFnError>,
  );
}

beforeEach(() => {
  resetMemoryRateLimiter();
  resetWorkerEnv();
  h.headers = { "cf-connecting-ip": "203.0.113.7" };
  h.lines = [];
  vi.spyOn(console, "warn").mockImplementation((line: string) => void h.lines.push(line));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rateLimit (in-memory fallback: no binding)", () => {
  it("allows up to the limit, then 429 RATE_LIMITED with Retry-After", async () => {
    const { limit } = RATE_LIMITS.email;
    for (let i = 0; i < limit; i++) {
      const { handlerCalled } = await runServerMiddleware([rateLimit({ key: "email" })], { context: { user: USER } });
      expect(handlerCalled).toBe(true);
    }
    const error = await rejection(runServerMiddleware([rateLimit({ key: "email" })], { context: { user: USER } }));
    expect(error).toBeInstanceOf(ServerFnError);
    expect(error).toMatchObject({ status: 429, code: "RATE_LIMITED", reason: "rate_limit_email" });
    expect(error!.retryAfter).toBeGreaterThan(0);
    expect(error!.retryAfter).toBeLessThanOrEqual(RATE_LIMITS.email.period);

    const response = error!.toResponse("req-1");
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe(String(error!.retryAfter));
    expect(await response.json()).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Try again shortly.",
        requestId: "req-1",
        reason: "rate_limit_email",
        retryAfter: error!.retryAfter,
      },
    });
  });

  it("isolates counters per user, per IP and per policy", async () => {
    const max = RATE_LIMITS.email.limit;
    for (let i = 0; i < max; i++) await runServerMiddleware([rateLimit({ key: "email" })], { context: { user: USER } });
    await expect(runServerMiddleware([rateLimit({ key: "email" })], { context: { user: USER } })).rejects.toBeInstanceOf(ServerFnError);

    // another user, the same user under another policy, and an anonymous caller are unaffected
    await expect(runServerMiddleware([rateLimit({ key: "email" })], { context: { user: { id: "someone-else" } } })).resolves.toMatchObject({
      handlerCalled: true,
    });
    await expect(runServerMiddleware([rateLimit({ key: "invite" })], { context: { user: USER } })).resolves.toMatchObject({
      handlerCalled: true,
    });
    await expect(runServerMiddleware([rateLimit({ key: "email" })])).resolves.toMatchObject({ handlerCalled: true });
  });

  it("keys anonymous callers by cf-connecting-ip", async () => {
    for (let i = 0; i < RATE_LIMITS.email.limit; i++) await runServerMiddleware([rateLimit({ key: "email" })]);
    await expect(runServerMiddleware([rateLimit({ key: "email" })])).rejects.toMatchObject({ status: 429 });
    h.headers["cf-connecting-ip"] = "198.51.100.1";
    await expect(runServerMiddleware([rateLimit({ key: "email" })])).resolves.toMatchObject({ handlerCalled: true });
  });

  it("resets after the period", async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < RATE_LIMITS.email.limit; i++) expect(await checkRateLimit("email", "user:x", t0)).toEqual({ ok: true });
    expect(await checkRateLimit("email", "user:x", t0 + 1000)).toEqual({ ok: false, retryAfter: RATE_LIMITS.email.period - 1 });
    expect(await checkRateLimit("email", "user:x", t0 + RATE_LIMITS.email.period * 1000)).toEqual({ ok: true });
  });

  it("logs the missing binding once per policy", async () => {
    await checkRateLimit("invite", "user:x");
    await checkRateLimit("invite", "user:x");
    const warnings = h.lines.map((line) => JSON.parse(line)).filter((j) => j.msg.includes("binding missing"));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ level: "warn", binding: "RATE_LIMIT_INVITE" });
  });

  it("returns the same middleware per key, so a chain counts one hit per call", () => {
    expect(rateLimit({ key: "invite" })).toBe(rateLimit({ key: "invite" }));
  });
});

describe("rateLimit (Workers Rate Limiting binding)", () => {
  it("asks the binding with the subject key and 429s with Retry-After = period when it says no", async () => {
    const limit = vi.fn(async ({ key }: { key: string }) => ({ success: key !== `user:${USER.id}` }));
    resetWorkerEnv({ RATE_LIMIT_DEFAULT: { limit } });
    await expect(runServerMiddleware([rateLimit({ key: "default" })])).resolves.toMatchObject({ handlerCalled: true });
    expect(limit).toHaveBeenCalledWith({ key: "ip:203.0.113.7" });
    const error = await rejection(runServerMiddleware([rateLimit({ key: "default" })], { context: { user: USER } }));
    expect(error).toMatchObject({ status: 429, retryAfter: RATE_LIMITS.default.period });
    expect(h.lines.filter((line) => line.includes("binding missing"))).toEqual([]);
  });
});

describe("wrangler.jsonc", () => {
  const strip = (source: string) =>
    source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/,(\s*[}\]])/g, "$1");
  type Binding = { name: string; namespace_id: string; simple: { limit: number; period: number } };
  const config = JSON.parse(strip(readFileSync(resolve(process.cwd(), "wrangler.jsonc"), "utf8"))) as {
    ratelimits?: Binding[];
    env: Record<string, { ratelimits?: Binding[] }>;
  };
  const scopes: [string, Binding[] | undefined][] = [
    ["top level", config.ratelimits],
    ...Object.entries(config.env).map(([name, env]) => [`env.${name}`, env.ratelimits] as [string, Binding[] | undefined]),
  ];

  it.each(scopes)("%s declares every RATE_LIMITS policy with the same limit and period", (_scope, bindings) => {
    expect(bindings).toBeDefined();
    for (const policy of Object.values(RATE_LIMITS)) {
      const binding = bindings!.find((b) => b.name === policy.binding);
      expect(binding, policy.binding).toBeDefined();
      expect(binding!.simple).toEqual({ limit: policy.limit, period: policy.period });
    }
  });

  it("gives every binding its own namespace_id across all environments", () => {
    const ids = scopes.flatMap(([, bindings]) => (bindings ?? []).map((b) => b.namespace_id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

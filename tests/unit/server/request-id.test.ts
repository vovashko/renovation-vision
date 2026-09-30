import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ responseHeaders: {} as Record<string, string>, lines: [] as Record<string, unknown>[] }));
vi.mock("@tanstack/react-start/server", () => ({
  setResponseHeader: (name: string, value: string) => void (h.responseHeaders[name] = value),
}));

const { requestIdMiddleware } = await import("@/server/middleware/request-id");
const { getRequestContext, resolveRequestId, runWithRequestContext, updateRequestContext } = await import("@/server/request-context.server");
const { logger } = await import("@/lib/logger");

type Server = (opts: { request: Request; pathname: string; next: (o?: { context?: Record<string, unknown> }) => Promise<unknown> }) => Promise<unknown>;
const server = requestIdMiddleware.options.server as unknown as Server;

/** Runs the middleware for `headers`; inside `next` it logs a line, then returns what next saw. */
async function run(headers: Record<string, string> = {}) {
  let seen: { context?: Record<string, unknown>; store?: ReturnType<typeof getRequestContext> } = {};
  await server({
    request: new Request("http://localhost/_serverFn/abc", { headers }),
    pathname: "/_serverFn/abc",
    next: async (opts) => {
      logger.info("inside the request", { email: "jonas@renovision.demo" });
      seen = { context: opts?.context, store: { ...getRequestContext()! } };
      return {};
    },
  });
  return seen;
}

beforeEach(() => {
  h.responseHeaders = {};
  h.lines = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => void h.lines.push(JSON.parse(line)));
});

afterEach(() => vi.restoreAllMocks());

describe("requestIdMiddleware", () => {
  it("propagates a safe incoming x-request-id to the context, the response header and the logs", async () => {
    const seen = await run({ "x-request-id": "edge-abc-123456" });
    expect(seen.context).toEqual({ requestId: "edge-abc-123456" });
    expect(seen.store).toMatchObject({ requestId: "edge-abc-123456", route: "/_serverFn/abc" });
    expect(h.responseHeaders["x-request-id"]).toBe("edge-abc-123456");
    expect(h.lines[0]).toMatchObject({ level: "info", msg: "inside the request", requestId: "edge-abc-123456", route: "/_serverFn/abc", email: "[email]" });
  });

  it("generates a UUID when there is no header", async () => {
    const seen = await run();
    const id = seen.context?.requestId as string;
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(h.responseHeaders["x-request-id"]).toBe(id);
    expect(h.lines[0].requestId).toBe(id);
  });

  it("replaces an unsafe incoming id (log/header injection, too short, too long)", async () => {
    expect(resolveRequestId("abcdefgh\n{\"level\":\"error\"}")).not.toContain("level"); // (Headers itself refuses a raw newline)
    for (const bad of ["short", "x".repeat(200), "<script>alert(1)</script>", "id with spaces ok?"]) {
      const seen = await run({ "x-request-id": bad });
      expect(seen.context?.requestId).not.toBe(bad);
    }
    expect(resolveRequestId("  ok-request-id-1 ")).toBe("ok-request-id-1");
  });

  it("reuses the context server.ts already opened instead of starting a new one", async () => {
    await runWithRequestContext({ requestId: "outer-request-1" }, async () => {
      const seen = await run({ "x-request-id": "ignored-because-outer" });
      expect(seen.context).toEqual({ requestId: "outer-request-1" });
      expect(seen.store?.route).toBe("/_serverFn/abc");
    });
  });

  it("keeps concurrent requests apart", async () => {
    const [a, b] = await Promise.all([run({ "x-request-id": "request-aaaa" }), run({ "x-request-id": "request-bbbb" })]);
    expect(a.store?.requestId).toBe("request-aaaa");
    expect(b.store?.requestId).toBe("request-bbbb");
  });

  it("carries fn and a hashed userId added later in the request", async () => {
    await runWithRequestContext({ requestId: "outer-request-2" }, async () => {
      updateRequestContext({ fn: "getMe", userId: "a0000000-0000-4000-8000-000000000001" });
      logger.info("done");
    });
    expect(h.lines[0]).toMatchObject({ requestId: "outer-request-2", fn: "getMe", userId: expect.stringMatching(/^u_[0-9a-f]{12}$/) });
    updateRequestContext({ fn: "outside" }); // no active request: a no-op, not a crash
  });
});

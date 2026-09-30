import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { serverFnBoundary, toServerFnError } = await import("@/server/middleware/boundary");
const { ServerFnError, isServerFnError } = await import("@/server/errors");
const { runWithRequestContext } = await import("@/server/request-context.server");

type ServerOpts = { next: () => Promise<unknown>; serverFnMeta: { name: string; id: string; filename: string }; method: string };
const server = serverFnBoundary.options.server as unknown as (opts: ServerOpts) => Promise<unknown>;
const client = serverFnBoundary.options.client as unknown as (opts: { next: () => Promise<unknown> }) => Promise<unknown>;

const lines: Record<string, unknown>[] = [];
beforeEach(() => {
  lines.length = 0;
  const capture = (line: string) => void lines.push(JSON.parse(line));
  vi.spyOn(console, "log").mockImplementation(capture);
  vi.spyOn(console, "warn").mockImplementation(capture);
  vi.spyOn(console, "error").mockImplementation(capture);
});
afterEach(() => vi.restoreAllMocks());

/** Runs the server half with `next` throwing/returning, inside a request context; returns the thrown value. */
async function serverThrow(next: () => Promise<unknown>) {
  return runWithRequestContext({ requestId: "req-boundary-1" }, () =>
    server({ next, serverFnMeta: { name: "doThing", id: "x", filename: "f" }, method: "POST" }).then(
      () => undefined,
      (thrown: unknown) => thrown,
    ),
  );
}

describe("serverFnBoundary (server)", () => {
  it("logs a successful call with fn, status and duration", async () => {
    await runWithRequestContext({ requestId: "req-ok-0001" }, () =>
      server({ next: async () => ({ result: 1 }), serverFnMeta: { name: "getMe", id: "x", filename: "f" }, method: "GET" }),
    );
    expect(lines[0]).toMatchObject({ level: "info", msg: "server fn", requestId: "req-ok-0001", fn: "getMe", method: "GET", status: 200 });
  });

  it("answers a ServerFnError with its status and stable JSON body", async () => {
    const thrown = await serverThrow(async () => {
      throw new ServerFnError("FORBIDDEN", "Two-factor verification required", { reason: "aal2_required" });
    });
    expect(thrown).toBeInstanceOf(Response);
    const response = thrown as Response;
    expect(response.status).toBe(403);
    expect(response.headers.get("x-rv-error")).toBe("1");
    expect(response.headers.get("x-request-id")).toBe("req-boundary-1");
    expect(await response.json()).toEqual({
      error: { code: "FORBIDDEN", message: "Two-factor verification required", requestId: "req-boundary-1", reason: "aal2_required" },
    });
    expect(lines[0]).toMatchObject({ level: "warn", fn: "doThing", status: 403, code: "FORBIDDEN" });
  });

  it("turns input validation failures into 400 with issues", async () => {
    const schema = z.object({ name: z.string().min(1) });
    const issues = schema.safeParse({ name: "" }).error!.issues;
    const thrown = (await serverThrow(async () => {
      throw new Error(JSON.stringify(issues, undefined, 2)); // how TanStack Start reports Standard Schema failures
    })) as Response;
    expect(thrown.status).toBe(400);
    expect((await thrown.json()).error).toMatchObject({ code: "BAD_REQUEST", issues: [{ path: "name", message: expect.any(String) }] });
  });

  it("hides unexpected errors behind a generic 500 and logs them (scrubbed)", async () => {
    const thrown = (await serverThrow(async () => {
      throw new Error("duplicate key for jonas@renovision.demo");
    })) as Response;
    expect(thrown.status).toBe(500);
    const body = await thrown.json();
    expect(body).toEqual({ error: { code: "INTERNAL", message: "Something went wrong on our end", requestId: "req-boundary-1" } });
    expect(lines[0]).toMatchObject({ level: "error", status: 500, err: { message: "duplicate key for [email]" } });
  });

  it("passes Responses and redirects through untouched", async () => {
    const raw = new Response("ok");
    expect(await serverThrow(async () => Promise.reject(raw))).toBe(raw);
  });

  it("toServerFnError keeps a ServerFnError as is", () => {
    const e = new ServerFnError("NOT_FOUND", "No such project");
    expect(toServerFnError(e)).toBe(e);
  });
});

describe("serverFnBoundary (client)", () => {
  it("rethrows an error response as a ServerFnError the caller can inspect", async () => {
    const response = new ServerFnError("RATE_LIMITED", "Too many requests. Try again shortly.", { retryAfter: 42 }).toResponse("req-9");
    const error = await client({ next: async () => ({ result: response }) }).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(isServerFnError(error)).toBe(true);
    expect(error).toMatchObject({ code: "RATE_LIMITED", status: 429, retryAfter: 42, requestId: "req-9" });
  });

  it("does the same when the response is thrown (server-side calls)", async () => {
    const response = new ServerFnError("UNAUTHORIZED", "Missing access token").toResponse();
    await expect(client({ next: async () => Promise.reject(response) })).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("leaves successful results and foreign responses alone", async () => {
    await expect(client({ next: async () => ({ result: { id: 1 } }) })).resolves.toEqual({ result: { id: 1 } });
    const foreign = new Response("{}", { status: 418 });
    await expect(client({ next: async () => ({ result: foreign }) })).resolves.toEqual({ result: foreign });
  });
});

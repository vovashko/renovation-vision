// Per-request context (request id, route, server function name, user id) in AsyncLocalStorage
// (available in the Worker through `nodejs_compat`). The logger reads it for every line, so code
// deep inside a request never has to pass the request id around.
//
// Lifecycle: src/server.ts opens the context for each request; `requestIdMiddleware` makes sure one
// exists (and opens it itself when server.ts isn't in front, e.g. in tests); `serverFnBoundary`
// adds `fn`; `requireUser` adds `userId` (hashed by the logger, never logged raw).
import { AsyncLocalStorage } from "node:async_hooks";
import { setLogContextProvider } from "@/lib/logger";

export const REQUEST_ID_HEADER = "x-request-id";

export type RequestContext = {
  requestId: string;
  route?: string;
  fn?: string;
  userId?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

setLogContextProvider(() => {
  const ctx = storage.getStore();
  if (!ctx) return undefined;
  const fields: Record<string, unknown> = { requestId: ctx.requestId };
  if (ctx.route) fields.route = ctx.route;
  if (ctx.fn) fields.fn = ctx.fn;
  if (ctx.userId) fields.userId = ctx.userId;
  return fields;
});

/** Runs `fn` with `ctx` as the active request context (visible to everything it awaits). */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** The active request's context, or undefined outside a request. */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Adds fields to the active request's context (a no-op outside a request). */
export function updateRequestContext(patch: Partial<Omit<RequestContext, "requestId">>) {
  const ctx = storage.getStore();
  if (ctx) Object.assign(ctx, patch);
}

// Accept a caller-supplied id (a proxy's or a client's, for end-to-end correlation) only when it is
// short and made of safe characters, so it can't smuggle anything into logs or headers.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/** The incoming `x-request-id` when it's safe to reuse, otherwise a fresh UUID. */
export function resolveRequestId(incoming: string | null | undefined): string {
  const value = incoming?.trim();
  return value && SAFE_REQUEST_ID.test(value) ? value : crypto.randomUUID();
}

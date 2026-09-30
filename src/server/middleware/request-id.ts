// Request middleware (every request: pages and server functions). Gives the request an id — the
// incoming `x-request-id` when it's safe to reuse, otherwise a UUID — puts it in the request
// context (so every log line carries it) and in `context.requestId`, and echoes it on the response
// as `x-request-id`. Registered first in src/start.ts, before the error middleware.
import { createMiddleware } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { getRequestContext, REQUEST_ID_HEADER, resolveRequestId, runWithRequestContext } from "../request-context.server";

export const requestIdMiddleware = createMiddleware().server(async ({ next, request, pathname }) => {
  const existing = getRequestContext();
  const requestId = existing?.requestId ?? resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const run = () => {
    setResponseHeader(REQUEST_ID_HEADER, requestId);
    return next({ context: { requestId } });
  };
  if (existing) {
    existing.route ??= pathname;
    return run();
  }
  return runWithRequestContext({ requestId, route: pathname }, run);
});

import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { logger } from "./lib/logger";
import { requestIdMiddleware } from "./server/middleware/request-id";
import { getRequestContext } from "./server/request-context.server";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    const requestId = getRequestContext()?.requestId;
    logger.error(error, { phase: "request" });
    return new Response(renderErrorPage({ requestId }), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8", ...(requestId ? { "x-request-id": requestId } : {}) },
    });
  }
});

// Server functions are same-origin RPC endpoints: refuse cross-site calls (Sec-Fetch-Site, then
// Origin, then Referer must be same-origin). Page requests are unaffected.
const csrfMiddleware = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

export const startInstance = createStart(() => ({
  // Order matters: the request id exists before anything can log or fail.
  requestMiddleware: [requestIdMiddleware, errorMiddleware, csrfMiddleware],
}));

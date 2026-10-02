import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { logger } from "./lib/logger";
import { captureServerException, tagRequestId, wrapWithSentry } from "./lib/sentry-worker";
import { buildHealthResponse } from "./server/healthz";
import { getRequestContext, REQUEST_ID_HEADER, resolveRequestId, runWithRequestContext } from "./server/request-context.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  const requestId = getRequestContext()?.requestId;
  return new Response(renderErrorPage({ requestId }), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8", ...(requestId ? { [REQUEST_ID_HEADER]: requestId } : {}) },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return fields.unhandled === true && fields.message === "HTTPError" && (fields.status === undefined || fields.status === responseStatus);
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  const error = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  logger.error(error, { phase: "ssr" });
  captureServerException(error); // no-op without SENTRY_DSN
  return brandedErrorResponse();
}

const innerHandler = {
  fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    // No auth, no PII, no SSR: answered before the request context / TanStack Start even start up.
    if (request.method === "GET" && url.pathname === "/healthz") return buildHealthResponse();

    // Open the request context here, outermost, so even a failure outside TanStack Start's
    // middleware is logged (and shown on the error page) with the request id that
    // requestIdMiddleware then reuses.
    const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
    tagRequestId(requestId); // every Sentry event from this request carries it as a tag; no-op without a DSN
    return runWithRequestContext({ requestId, route: url.pathname }, async () => {
      try {
        const handler = await getServerEntry();
        const response = await handler.fetch(request, env, ctx);
        return await normalizeCatastrophicSsrResponse(response);
      } catch (error) {
        logger.error(error, { phase: "worker" });
        captureServerException(error); // no-op without SENTRY_DSN
        return brandedErrorResponse();
      }
    });
  },
};

// @sentry/cloudflare's instrumentation (EU data region; SENTRY_DSN is a secret — see
// src/lib/sentry-worker.ts). A no-op (the handler above, untouched) without SENTRY_DSN: no network
// calls, nothing to configure for local dev or CI.
export default wrapWithSentry(innerHandler, () => getRequestContext());

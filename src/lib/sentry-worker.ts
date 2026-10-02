// Worker-side Sentry (EU data region: SENTRY_DSN must point at a *.ingest.de.sentry.io project).
// SENTRY_DSN is a secret (`wrangler secret put SENTRY_DSN`; `.dev.vars` locally), validated by
// src/lib/env.ts. Without it, `wrapWithSentry` hands back the original handler untouched and
// `captureServerException`/`tagRequestId` are no-ops: no network calls, nothing to configure for
// local dev or CI.
//
// This file must not import src/server/request-context.server.ts directly (only src/server/**,
// src/start.ts and src/server.ts may — see tests/unit/arch/boundaries.test.ts), so the hashed user
// id for `beforeSend` is read through `getContext`, injected by src/server.ts (the one file that
// is allowed to import it) instead.
import "@tanstack/react-start/server-only";
import * as Sentry from "@sentry/cloudflare";
import { getServerEnv } from "@/lib/env";
import { hashUserId } from "./pii-scrub";
import { scrubBreadcrumb, scrubSentryEvent } from "./sentry-scrub";
import { SENTRY_RELEASE, SENTRY_TRACES_SAMPLE_RATE } from "./sentry-config";

export type WorkerHandler = { fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response };
type RequestContextSnapshot = { requestId?: string; userId?: string } | undefined;

function buildOptions(getContext: () => RequestContextSnapshot): Sentry.CloudflareOptions | undefined {
  const env = getServerEnv();
  if (!env.sentryDsn) return undefined; // no-op: no DSN configured
  return {
    dsn: env.sentryDsn,
    sendDefaultPii: false,
    environment: env.appEnv,
    release: SENTRY_RELEASE,
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    beforeSend: (event) => {
      const scrubbed = scrubSentryEvent(event);
      const userId = getContext()?.userId;
      if (userId) scrubbed.user = { id: hashUserId(userId) };
      return scrubbed as typeof event;
    },
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  };
}

/**
 * Wraps the Worker's exported handler with @sentry/cloudflare's instrumentation. `getContext`
 * supplies the active request's context (for the hashed user id) without this module importing
 * request-context.server.ts itself.
 */
export function wrapWithSentry(handler: WorkerHandler, getContext: () => RequestContextSnapshot): WorkerHandler {
  return Sentry.withSentry(() => buildOptions(getContext), handler) as WorkerHandler;
}

/** Tags every Sentry event from the current request with its request id (ambient isolation scope). */
export function tagRequestId(requestId: string): void {
  Sentry.setTag("requestId", requestId);
}

/** Reports a genuinely uncaught error (one that would otherwise only reach Workers Logs). */
export function captureServerException(error: unknown): void {
  if (!getServerEnv().sentryDsn) return;
  Sentry.captureException(error);
}

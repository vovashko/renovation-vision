// Browser Sentry (EU data region: VITE_SENTRY_DSN must point at a *.ingest.de.sentry.io project).
// A DSN is public by design — anyone can read one out of any shipped bundle; it only lets the
// browser POST events to that one project, nothing more. Without VITE_SENTRY_DSN every export here
// is a no-op: no `Sentry.init`, no network calls, nothing to configure for local dev or CI.
//
// `createClientOnlyFn` (same mechanism TanStack Start uses for request-locale.ts) makes the Start
// compiler replace these implementations with a no-op for the ssr/Worker build and dead-code-
// eliminate the now-unused `@sentry/react` import there, so this file never pulls the (DOM-only)
// browser SDK into the Worker bundle even though src/router.tsx imports it unconditionally.
import { createClientOnlyFn } from "@tanstack/react-start";
import * as Sentry from "@sentry/react";
import { isServerFnError } from "@/server/errors";
import { hashUserId } from "./pii-scrub";
import { scrubBreadcrumb, scrubSentryEvent } from "./sentry-scrub";
import { SENTRY_RELEASE, SENTRY_TRACES_SAMPLE_RATE } from "./sentry-config";

let initialized = false;

/** Call once, client-side (src/router.tsx). A no-op without VITE_SENTRY_DSN or on a second call. */
export const initBrowserSentry = createClientOnlyFn((): void => {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  initialized = true;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    environment: import.meta.env.MODE,
    release: SENTRY_RELEASE,
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    integrations: [], // no session replay
    beforeSend: (event) => scrubSentryEvent(event) as typeof event,
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  });
});

/** Sets (or clears) the Sentry user: the hashed id only, the same hash the logger uses — never the email. */
export const setSentryUser = createClientOnlyFn((userId: string | null | undefined): void => {
  if (!initialized) return;
  Sentry.setUser(userId ? { id: hashUserId(userId) } : null);
});

/**
 * Reports an error to Sentry. A `ServerFnError` below 500 is an expected, handled rejection
 * (401/403/404/429) and is never reported; a 5xx one is, tagged with its request id so the Sentry
 * issue and the matching Workers Logs line can be found from each other.
 */
export const reportClientError = createClientOnlyFn((error: unknown): void => {
  if (!initialized) return;
  if (isServerFnError(error) && error.status < 500) return;
  Sentry.withScope((scope) => {
    if (isServerFnError(error) && error.requestId) scope.setTag("requestId", error.requestId);
    Sentry.captureException(error);
  });
});

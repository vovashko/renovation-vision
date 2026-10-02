// Sentry event/breadcrumb scrubbing, reused by both the browser (sentry-client.ts) and the Worker
// (sentry-worker.ts) `beforeSend`/`beforeBreadcrumb`. Built on the logger's PII rules
// (src/lib/pii-scrub.ts), so a Sentry issue never carries more than Workers Logs already allows:
// emails, phone numbers, JWTs, Bearer tokens and Supabase keys inside any string become
// placeholders, and password/secret/token/cookie/apikey-like fields are redacted.
//
// On top of that, Sentry-specific hardening:
// - `user` is reduced to the hashed id only (the same hash the logger uses for `userId`) — never
//   an email, username or IP address;
// - request `cookies` are dropped entirely, and the `authorization`/`cookie` headers are redacted.
//
// Type-only imports from @sentry/core (erased at compile time, zero runtime SDK dependency), so
// this module stays trivially unit-testable (no Sentry SDK import, no network) while matching the
// real event/breadcrumb shape exactly. Callers (sentry-client.ts, sentry-worker.ts) cast the
// result back to their specific event subtype (`ErrorEvent`), since Sentry's own `beforeSend`
// signature is narrower than the base `Event` type these functions operate on.
import type { Breadcrumb, Event, RequestEventData, User } from "@sentry/core";
import { hashUserId, scrub, scrubString } from "./pii-scrub";

const DROPPED_HEADER_RE = /^(cookie|authorization)$/i;

function scrubHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) out[name] = DROPPED_HEADER_RE.test(name) ? "[redacted]" : scrubString(value);
  return out;
}

function scrubRequest(request: RequestEventData): RequestEventData {
  // Cookies can carry the session; never send them to Sentry at all (not even scrubbed).
  const { cookies: _cookies, headers, ...rest } = request;
  const scrubbedRest = scrub(rest) as RequestEventData;
  return headers ? { ...scrubbedRest, headers: scrubHeaders(headers) } : scrubbedRest;
}

/** Hashed id only (the same hash as the logger's `userId`); email/username/ip are always dropped. */
export function scrubUser(user: User | null | undefined): User | undefined {
  if (!user || user.id == null || user.id === "") return undefined;
  return { id: hashUserId(String(user.id)) };
}

/** `beforeBreadcrumb`: scrubs a breadcrumb's message and data in place (returns a new object). */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const next: Breadcrumb = { ...breadcrumb };
  if (typeof next.message === "string") next.message = scrubString(next.message);
  if (next.data) next.data = scrub(next.data) as Breadcrumb["data"];
  return next;
}

/** `beforeSend`: scrubs PII from every part of the event Sentry would otherwise upload verbatim. */
export function scrubSentryEvent(event: Event): Event {
  const next: Event = { ...event };
  if (typeof next.message === "string") next.message = scrubString(next.message);
  if (next.exception?.values) {
    next.exception = {
      values: next.exception.values.map((value) => ({
        ...value,
        value: typeof value.value === "string" ? scrubString(value.value) : value.value,
      })),
    };
  }
  if (next.extra) next.extra = scrub(next.extra) as Event["extra"];
  if (next.contexts) next.contexts = scrub(next.contexts) as Event["contexts"];
  if (next.tags) next.tags = scrub(next.tags) as Event["tags"];
  if (next.breadcrumbs) next.breadcrumbs = next.breadcrumbs.map(scrubBreadcrumb);
  if (next.request) next.request = scrubRequest(next.request);
  next.user = scrubUser(next.user);
  return next;
}

// PII scrubbing, shared by the logger (src/lib/logger.ts) and Sentry (src/lib/sentry-scrub.ts) so a
// log line and a Sentry event never disagree about what counts as sensitive. Factored out of
// logger.ts in T26 (observability) — behavior and the logger's own tests are unchanged; the logger
// re-exports `scrubString`/`hashUserId`/`scrub` from here.
//
// - emails, phone numbers, JWTs, Bearer tokens and Supabase keys inside any string become
//   "[email]", "[phone]", "[jwt]", "Bearer [redacted]", "[supabase-key]";
// - fields named like password/secret/token/authorization/cookie/apikey become "[redacted]";
// - `userId` is replaced by a short, stable SHA-256 prefix ("u_1a2b3c4d5e6f").
//
// No Node APIs, so it runs in workerd, in Node (tests) and in the browser.
import { sha256Hex } from "./sha256";

const JWT_RE = /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/g;
const SUPABASE_KEY_RE = /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// A run of 9–15 digits with the usual separators, not glued to a word or an id (UUIDs, ISO dates
// and IPs don't match: they are either adjacent to letters/dashes or have too few digits).
const PHONE_RE = /(?<![\w-])(?:\+|\()?\d[\d\s().-]{7,}\d(?![\w-])/g;
const SENSITIVE_KEY_RE = /pass(word)?|secret|token|authorization|cookie|api_?key|jwt|credential/i;

/** Replaces emails, phone numbers, JWTs, Bearer tokens and Supabase keys in a string. */
export function scrubString(value: string): string {
  return value
    .replace(BEARER_RE, "Bearer [redacted]")
    .replace(JWT_RE, "[jwt]")
    .replace(SUPABASE_KEY_RE, "[supabase-key]")
    .replace(EMAIL_RE, "[email]")
    .replace(PHONE_RE, (match) => {
      const digits = match.replace(/\D/g, "").length;
      return digits >= 9 && digits <= 15 ? "[phone]" : match;
    });
}

/** Pseudonymous, stable id for logs and Sentry: "u_" + the first 12 hex chars of SHA-256(userId). */
export function hashUserId(userId: string): string {
  return `u_${sha256Hex(userId).slice(0, 12)}`;
}

function serializeError(error: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (!(error instanceof Error)) return scrub(error, depth, seen);
  const out: Record<string, unknown> = { name: error.name, message: scrubString(error.message) };
  if (error.stack) out.stack = scrubString(error.stack);
  const code = (error as { code?: unknown }).code;
  if (code !== undefined) out.code = scrub(code, depth + 1, seen);
  if (error.cause !== undefined) out.cause = serializeError(error.cause, depth + 1, seen);
  return out;
}

/** Deep-copies a value with every string scrubbed, sensitive keys redacted and `userId` hashed. */
export function scrub(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") {
    return typeof value === "bigint" || typeof value === "symbol" || typeof value === "function" ? String(value) : value;
  }
  if (value instanceof Error) return serializeError(value, depth, seen);
  if (value instanceof Date) return value.toISOString();
  if (depth >= 6) return "[depth]";
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => scrub(item, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "userId" && typeof item === "string") out[key] = hashUserId(item);
    else if (SENSITIVE_KEY_RE.test(key) && item != null && typeof item !== "boolean" && typeof item !== "number") out[key] = "[redacted]";
    else out[key] = scrub(item, depth + 1, seen);
  }
  return out;
}

// Structured JSON logging for the Worker (Cloudflare Workers Logs indexes JSON console lines).
//
//   logger.info("invite sent", { projectId });
//   const log = logger.child({ fn: "inviteMember" }); log.warn("seat limit reached", { limit });
//   logger.error(error, { stage: "upload" });   // or logger.error("upload failed", { err: error })
//
// One line per call: {"level","msg","time","requestId","route","fn","userId",...fields}. Request
// context (requestId, route/fn, userId) comes from the active request automatically:
// src/server/request-context.server.ts registers itself with `setLogContextProvider`. Every line is scrubbed:
// - `userId` is replaced by a short SHA-256 prefix ("u_1a2b3c4d5e6f"), stable across lines, so a
//   user's requests can be correlated without logging who they are;
// - emails, phone numbers, JWTs, Bearer tokens and Supabase keys inside any string become
//   "[email]", "[phone]", "[jwt]", "Bearer [redacted]", "[supabase-key]";
// - fields named like password/secret/token/authorization/cookie/apikey become "[redacted]".
// No Node APIs, so it runs in workerd, in Node (tests) and in the browser.
import { sha256Hex } from "./sha256";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  /** Pass an Error as the message to log its name/message/stack under `err`. */
  error(msg: string | unknown, fields?: LogFields): void;
  /** A logger whose lines all carry `bindings` (e.g. `{ fn: "getMe" }`). */
  child(bindings: LogFields): Logger;
}

export type LogSink = (level: LogLevel, line: string) => void;

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/* ------------------------------------------------------------------------------------------------
 * PII scrubbing
 * ---------------------------------------------------------------------------------------------- */

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

/** Pseudonymous, stable id for logs: "u_" + the first 12 hex chars of SHA-256(userId). */
export function hashUserId(userId: string): string {
  return `u_${sha256Hex(userId).slice(0, 12)}`;
}

function serializeError(error: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (!(error instanceof Error)) return scrub(error, depth, seen);
  const out: LogFields = { name: error.name, message: scrubString(error.message) };
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
  const out: LogFields = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "userId" && typeof item === "string") out[key] = hashUserId(item);
    else if (SENSITIVE_KEY_RE.test(key) && item != null && typeof item !== "boolean" && typeof item !== "number") out[key] = "[redacted]";
    else out[key] = scrub(item, depth + 1, seen);
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------
 * Request context
 * ---------------------------------------------------------------------------------------------- */

let contextProvider: () => LogFields | undefined = () => undefined;

/**
 * Lets the server attach the active request's context (requestId, route/fn, userId) to every line.
 * src/server/request-context.server.ts calls this once; nothing else should.
 */
export function setLogContextProvider(provider: () => LogFields | undefined) {
  contextProvider = provider;
}

/* ------------------------------------------------------------------------------------------------
 * Logger
 * ---------------------------------------------------------------------------------------------- */

const consoleSink: LogSink = (level, line) => {
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

export type CreateLoggerOptions = { bindings?: LogFields; level?: LogLevel; sink?: LogSink; now?: () => Date };

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const { bindings = {}, level: minLevel = "info", sink = consoleSink, now = () => new Date() } = options;

  const write = (level: LogLevel, msg: unknown, fields?: LogFields) => {
    if (LEVELS[level] < LEVELS[minLevel]) return;
    let message: string;
    const extra: LogFields = { ...fields };
    if (msg instanceof Error) {
      message = msg.message;
      extra.err ??= msg;
    } else {
      message = typeof msg === "string" ? msg : String(msg);
    }
    let context: LogFields | undefined;
    try {
      context = contextProvider();
    } catch {
      context = undefined;
    }
    const line = scrub({ ...context, ...bindings, ...extra }) as LogFields;
    // level/msg/time first, then the well-known context keys, then everything else.
    const ordered: LogFields = { level, msg: scrubString(message), time: now().toISOString() };
    for (const key of ["requestId", "route", "fn", "userId"]) if (line[key] !== undefined) ordered[key] = line[key];
    for (const [key, value] of Object.entries(line)) if (!(key in ordered) && value !== undefined) ordered[key] = value;
    let json: string;
    try {
      json = JSON.stringify(ordered);
    } catch {
      json = JSON.stringify({ level, msg: scrubString(message), time: ordered.time, logError: "unserializable fields" });
    }
    sink(level, json);
  };

  return {
    debug: (msg, fields) => write("debug", msg, fields),
    info: (msg, fields) => write("info", msg, fields),
    warn: (msg, fields) => write("warn", msg, fields),
    error: (msg, fields) => write("error", msg, fields),
    child: (childBindings) => createLogger({ ...options, bindings: { ...bindings, ...childBindings } }),
  };
}

/** The app-wide logger. Use `logger.child({ fn: "…" })` for per-function context. */
export const logger: Logger = createLogger();

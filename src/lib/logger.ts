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
//
// The scrubbing rules themselves (and `hashUserId`) live in src/lib/pii-scrub.ts, shared with
// Sentry's beforeSend/beforeBreadcrumb (src/lib/sentry-scrub.ts) — re-exported here unchanged so
// this module's public API and tests are unaffected.
import { scrub, scrubString } from "./pii-scrub";

export { hashUserId, scrub, scrubString } from "./pii-scrub";

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

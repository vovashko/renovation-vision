// The one error type server functions throw on purpose, and its wire format.
//
// On the server, `serverFnBoundary` (./middleware/boundary.ts) turns any ServerFnError into a JSON
// response with the matching HTTP status and a stable body:
//
//   HTTP/1.1 401            x-rv-error: 1   x-request-id: 3f0c…
//   { "error": { "code": "UNAUTHORIZED", "message": "Missing access token", "requestId": "3f0c…" } }
//
// 429s add `Retry-After` (seconds) and `error.retryAfter`; 400s from input validation add
// `error.issues: [{ path, message }]`; 403s may add `error.reason` (e.g. "aal2_required").
// In the browser the same middleware turns that response back into a thrown ServerFnError, so
// callers `catch (e) { if (isServerFnError(e) && e.code === "UNAUTHORIZED") … }`.
//
// Isomorphic on purpose (no server imports): client code may import it to inspect errors.

export const SERVER_ERROR_HEADER = "x-rv-error";

export const SERVER_ERROR_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  UNAVAILABLE: 503,
} as const;

export type ServerErrorCode = keyof typeof SERVER_ERROR_STATUS;

export type ValidationIssue = { path: string; message: string };

export type ServerErrorBody = {
  error: {
    code: ServerErrorCode;
    message: string;
    requestId?: string;
    reason?: string;
    retryAfter?: number;
    issues?: ValidationIssue[];
  };
};

type ServerFnErrorExtra = { reason?: string; retryAfter?: number; issues?: ValidationIssue[]; requestId?: string };

export class ServerFnError extends Error {
  readonly code: ServerErrorCode;
  readonly status: number;
  readonly reason?: string;
  readonly retryAfter?: number;
  readonly issues?: ValidationIssue[];
  readonly requestId?: string;

  constructor(code: ServerErrorCode, message: string, extra: ServerFnErrorExtra = {}) {
    super(message);
    this.name = "ServerFnError";
    this.code = code;
    this.status = SERVER_ERROR_STATUS[code];
    this.reason = extra.reason;
    this.retryAfter = extra.retryAfter;
    this.issues = extra.issues;
    this.requestId = extra.requestId;
  }

  toBody(requestId = this.requestId): ServerErrorBody {
    const error: ServerErrorBody["error"] = { code: this.code, message: this.message };
    if (requestId) error.requestId = requestId;
    if (this.reason) error.reason = this.reason;
    if (this.retryAfter !== undefined) error.retryAfter = this.retryAfter;
    if (this.issues) error.issues = this.issues;
    return { error };
  }

  toResponse(requestId = this.requestId): Response {
    const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store", [SERVER_ERROR_HEADER]: "1" });
    if (requestId) headers.set("x-request-id", requestId);
    if (this.retryAfter !== undefined) headers.set("retry-after", String(this.retryAfter));
    return new Response(JSON.stringify(this.toBody(requestId)), { status: this.status, headers });
  }

  /** The ServerFnError a response carries, or undefined if it isn't one of ours. */
  static async fromResponse(value: unknown): Promise<ServerFnError | undefined> {
    if (!(value instanceof Response) || value.headers.get(SERVER_ERROR_HEADER) !== "1") return undefined;
    let body: Partial<ServerErrorBody> = {};
    try {
      body = (await value.clone().json()) as Partial<ServerErrorBody>;
    } catch {
      // Fall through with an empty body: the status still tells us what happened.
    }
    const code = body.error?.code && body.error.code in SERVER_ERROR_STATUS ? body.error.code : codeForStatus(value.status);
    return new ServerFnError(code, body.error?.message ?? `Request failed (${value.status})`, {
      reason: body.error?.reason,
      retryAfter: body.error?.retryAfter,
      issues: body.error?.issues,
      requestId: body.error?.requestId ?? value.headers.get("x-request-id") ?? undefined,
    });
  }
}

function codeForStatus(status: number): ServerErrorCode {
  const match = (Object.entries(SERVER_ERROR_STATUS) as [ServerErrorCode, number][]).find(([, s]) => s === status);
  return match?.[0] ?? (status >= 500 ? "INTERNAL" : "BAD_REQUEST");
}

/** True for a ServerFnError, including one rebuilt in another realm (checks the shape, not the prototype). */
export function isServerFnError(value: unknown): value is ServerFnError {
  return (
    value instanceof ServerFnError ||
    (value instanceof Error && value.name === "ServerFnError" && typeof (value as { code?: unknown }).code === "string")
  );
}

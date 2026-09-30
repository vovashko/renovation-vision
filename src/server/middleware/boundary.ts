// Function middleware that wraps every server function built from src/server/fn.ts (it is the
// first one in `publicFn`/`authedFn`):
//
// server  - records the function name in the request context and logs one line per call
//           (`fn`, `method`, `status`, `durationMs`; the request id and hashed user id come from
//           the context);
//         - turns a thrown ServerFnError into its JSON response (see ../errors.ts), input
//           validation failures into a 400 with `issues`, and anything unexpected into a generic
//           500 whose details stay in the log (the browser only sees the request id).
// client  - turns such a response back into a thrown ServerFnError for the caller.
//
// Redirects and notFound() pass through untouched.
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { logger } from "@/lib/logger";
import { ServerFnError, type ValidationIssue } from "../errors";
import { getRequestContext, updateRequestContext } from "../request-context.server";

/** Standard Schema issues as TanStack Start reports them: `new Error(JSON.stringify(issues))`. */
function validationIssues(error: unknown): ValidationIssue[] | undefined {
  if (!(error instanceof Error)) return undefined;
  const zodIssues = (error as { issues?: unknown }).issues; // a ZodError thrown by a function validator
  let raw: unknown = Array.isArray(zodIssues) ? zodIssues : undefined;
  if (!raw && error.message.trimStart().startsWith("[")) {
    try {
      raw = JSON.parse(error.message);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  if (!raw.every((issue) => issue && typeof issue === "object" && typeof (issue as { message?: unknown }).message === "string"))
    return undefined;
  return raw.map((issue: { message: string; path?: unknown[] }) => ({
    path: (issue.path ?? [])
      .map((segment) => (segment && typeof segment === "object" && "key" in segment ? String(segment.key) : String(segment)))
      .join("."),
    message: issue.message,
  }));
}

/** Maps anything a server function (or its middleware) threw to the ServerFnError we answer with. */
export function toServerFnError(error: unknown): ServerFnError {
  if (error instanceof ServerFnError) return error;
  const issues = validationIssues(error);
  if (issues) return new ServerFnError("BAD_REQUEST", "Invalid input", { issues });
  return new ServerFnError("INTERNAL", "Something went wrong on our end");
}

export const serverFnBoundary = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    try {
      const result = await next();
      const error = await ServerFnError.fromResponse((result as { result?: unknown }).result);
      if (error) throw error;
      return result;
    } catch (thrown) {
      const error = await ServerFnError.fromResponse(thrown);
      throw error ?? thrown;
    }
  })
  .server(async ({ next, serverFnMeta, method }) => {
    const started = Date.now();
    updateRequestContext({ fn: serverFnMeta.name });
    try {
      const result = await next();
      logger.info("server fn", { method, status: 200, durationMs: Date.now() - started });
      return result;
    } catch (thrown) {
      if (thrown instanceof Response || isRedirect(thrown) || isNotFound(thrown)) throw thrown;
      const error = toServerFnError(thrown);
      const fields = { method, status: error.status, code: error.code, durationMs: Date.now() - started };
      if (error.status >= 500) logger.error("server fn failed", { ...fields, err: thrown });
      else logger.warn("server fn rejected", { ...fields, reason: error.reason ?? error.message });
      throw error.toResponse(getRequestContext()?.requestId);
    }
  });

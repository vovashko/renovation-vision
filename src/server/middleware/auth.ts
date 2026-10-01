// Authentication and authorization middleware for server functions. They compose: each
// authorization check depends on `requireUser`, and TanStack Start runs a shared middleware once
// per call however many times it appears in the chain.
//
//   authedFn(...)                                         // = requireUser (+ boundary, rate limit)
//     .middleware([requireAal2])                          // 403 unless the session is MFA-verified
//     .middleware([requireAccountType("manager", "admin")]) // 403 unless profiles.account_type matches
//     .middleware([requireProjectRole((i: { projectId: string }) => i.projectId, "manager")])
//
// requireUser:
//   client - attaches `Authorization: Bearer <access_token>` from the browser Supabase session
//            (localStorage today) to every server-function call.
//   server - takes that Bearer token, or falls back to the Supabase session cookies (T21), verifies
//            it with `auth.getClaims(token)` and rejects a missing, malformed, expired or badly
//            signed token with 401. Context gets `user: { id, email, aal, role }` and `supabase`,
//            a per-request client acting as that user (RLS applies).
// How verification works locally vs hosted: see ../auth.server.ts.
//
// This file is isomorphic (the `.client()` half ships to the browser). Server logic lives in
// ../auth.server.ts and is only referenced inside `.server()`, which the Start compiler strips
// from the client build together with those imports.
import { createMiddleware } from "@tanstack/react-start";
import type { Enums } from "@/lib/database.types";
import { supabase as browserSupabase } from "@/lib/supabase";
import type { ServerSupabase } from "@/lib/supabase/server";
import { authenticateRequest, hasProjectRole, loadAccountType, parseProjectId } from "../auth.server";
import { ServerFnError } from "../errors";
import { updateRequestContext } from "../request-context.server";

export type Aal = "aal1" | "aal2";
export type AuthUser = { id: string; email: string | null; aal: Aal; role: string };
export type AuthContext = { user: AuthUser; supabase: ServerSupabase };
export type AccountType = Enums<"account_type">;
export type ProjectRoleCheck = "manager" | "client" | "member";

async function browserAccessToken(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined; // SSR-side calls authenticate via the request itself
  try {
    const { data } = await browserSupabase.auth.getSession(); // refreshes an expired token first
    return data.session?.access_token ?? undefined;
  } catch {
    return undefined; // unconfigured client: let the server answer 401
  }
}

/** 401 unless the request carries a valid Supabase access token. Context: `user`, `supabase` (as the user). */
export const requireUser = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const token = await browserAccessToken();
    return next(token ? { headers: { Authorization: `Bearer ${token}` } } : {});
  })
  .server(async ({ next }) => {
    const { user, supabase } = await authenticateRequest();
    updateRequestContext({ userId: user.id });
    return next({ context: { user, supabase } });
  });

/** 403 unless the session is MFA-verified (`aal2`). The error's `reason` is "aal2_required". */
export const requireAal2 = createMiddleware({ type: "function" })
  .middleware([requireUser])
  .server(async ({ next, context }) => {
    if (context.user.aal !== "aal2") {
      throw new ServerFnError("FORBIDDEN", "Two-factor verification required", { reason: "aal2_required" });
    }
    return next();
  });

/**
 * 403 unless `profiles.account_type` is one of `allowed` ("manager" | "client" | "admin", from the
 * generated `account_type` enum). Adds `accountType` to the context.
 */
export function requireAccountType(...allowed: [AccountType, ...AccountType[]]) {
  return createMiddleware({ type: "function" })
    .middleware([requireUser])
    .server(async ({ next, context }) => {
      const accountType = await loadAccountType(context);
      if (!accountType || !allowed.includes(accountType)) {
        throw new ServerFnError("FORBIDDEN", "Your account can't do this", { reason: `account_type_${allowed.join("_or_")}_required` });
      }
      return next({ context: { accountType } });
    });
}

/**
 * 403 unless the caller is a `role` ("member" = any role) on the project that `projectIdFrom`
 * picks out of the input, checked in Postgres as the user (is_project_manager / is_project_client /
 * is_project_member). NOTE: middleware runs before the function's own validator, so `projectIdFrom`
 * sees the raw input; the id it returns must be a UUID (400 otherwise). Adds `projectId` to the context.
 */
export function requireProjectRole<TInput>(projectIdFrom: (input: TInput) => unknown, role: ProjectRoleCheck) {
  return createMiddleware({ type: "function" })
    .middleware([requireUser])
    .server(async ({ next, context, data }) => {
      let candidate: unknown;
      try {
        candidate = projectIdFrom(data as TInput);
      } catch {
        candidate = undefined;
      }
      const projectId = parseProjectId(candidate);
      if (!(await hasProjectRole(context, projectId, role))) {
        throw new ServerFnError("FORBIDDEN", "You don't have access to this project", { reason: `project_${role}_required` });
      }
      return next({ context: { projectId } });
    });
}

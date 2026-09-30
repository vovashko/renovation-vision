// The logic behind the auth middleware (./middleware/auth.ts), kept in a `.server.ts` module so it
// can never be bundled for the browser: the middleware file itself is isomorphic (its `.client()`
// half runs in the browser) and TanStack Start only strips what sits inside `.server()`.
// Exported for tests and for T21's route guards.
//
// Token verification (supabase-js ≥ 2.117 `auth.getClaims(token)`): a token signed with an
// asymmetric key (ES256/RS256 — the local CLI stack and new hosted projects) is checked locally
// with WebCrypto against the project's JWKS, fetched from /auth/v1/.well-known/jwks.json and cached
// per isolate for 10 minutes (see getJwtVerifier). A token signed with the legacy symmetric JWT
// secret (HS256) can't be checked locally, so supabase-js asks the Auth server (`getUser(token)`,
// one request per call). Either way the signature and `exp` are enforced. A token revoked by
// sign-out stays valid until it expires (≤ 1 h by default), as with any stateless JWT.
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { createServerSupabase, getJwtVerifier } from "@/lib/supabase/server";
import { ServerFnError } from "./errors";
import type { AccountType, AuthContext, AuthUser, ProjectRoleCheck } from "./middleware/auth";

const MISSING = () => new ServerFnError("UNAUTHORIZED", "Missing access token", { reason: "missing_token" });
const INVALID = () => new ServerFnError("UNAUTHORIZED", "Invalid or expired access token", { reason: "invalid_token" });

/** The token from an `Authorization: Bearer <token>` header; undefined when there is no header; 401 when it's malformed. */
export function parseBearer(header: string | null | undefined): string | undefined {
  if (header == null || header.trim() === "") return undefined;
  const match = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i.exec(header.trim());
  if (!match) throw INVALID();
  return match[1];
}

const claimsSchema = z.object({
  sub: z.string().min(1),
  role: z.literal("authenticated"),
  email: z.string().optional().nullable(),
  aal: z.enum(["aal1", "aal2"]).optional(),
  is_anonymous: z.boolean().optional(),
});

/** Maps verified JWT claims to the user we put in context. Anonymous or non-`authenticated` tokens are rejected. */
export function userFromClaims(claims: unknown): AuthUser {
  const parsed = claimsSchema.safeParse(claims);
  if (!parsed.success || parsed.data.is_anonymous) throw INVALID();
  return { id: parsed.data.sub, email: parsed.data.email || null, aal: parsed.data.aal ?? "aal1", role: parsed.data.role };
}

/** Verifies an access token's signature and expiry and returns its user; 401 when it doesn't verify. */
export async function verifyAccessToken(token: string): Promise<AuthUser> {
  const { data, error } = await getJwtVerifier().auth.getClaims(token);
  if (error || !data) {
    // Failing to reach the JWKS/Auth endpoint is our problem, not a bad token.
    if (error && (error.name === "AuthRetryableFetchError" || (typeof error.status === "number" && error.status >= 500))) {
      throw new ServerFnError("UNAVAILABLE", "Authentication is temporarily unavailable");
    }
    throw INVALID();
  }
  return userFromClaims(data.claims);
}

/**
 * Authenticates the current request: the Bearer token if there is an Authorization header,
 * otherwise the Supabase session cookies. Throws a 401 ServerFnError when neither yields a valid token.
 */
export async function authenticateRequest(authorization: string | null | undefined = getRequestHeader("authorization")): Promise<AuthContext> {
  const bearer = parseBearer(authorization);
  if (bearer) {
    const user = await verifyAccessToken(bearer);
    return { user, supabase: createServerSupabase({ accessToken: bearer }) };
  }
  // Cookie session (T21). getSession() reads — and if needed refreshes — the cookie session; its
  // contents aren't trusted until the access token passes the same verification as a Bearer token.
  const cookieClient = createServerSupabase();
  const { data } = await cookieClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw MISSING();
  const user = await verifyAccessToken(token);
  return { user, supabase: cookieClient };
}

/** Reads the caller's `profiles.account_type` as the user (RLS: a user can always read their own profile). */
export async function loadAccountType(ctx: AuthContext): Promise<AccountType | null> {
  const { data, error } = await ctx.supabase.from("profiles").select("account_type").eq("id", ctx.user.id).maybeSingle();
  if (error) throw error;
  return data?.account_type ?? null;
}

const PROJECT_ROLE_RPC = {
  manager: "is_project_manager",
  client: "is_project_client",
  member: "is_project_member",
} as const satisfies Record<ProjectRoleCheck, string>;

/** Asks Postgres (as the user) whether they hold `role` on the project, via the RLS helper functions. */
export async function hasProjectRole(ctx: AuthContext, projectId: string, role: ProjectRoleCheck): Promise<boolean> {
  const { data, error } = await ctx.supabase.rpc(PROJECT_ROLE_RPC[role], { p_project: projectId });
  if (error) throw error;
  return data === true;
}

/** The project id a `requireProjectRole` picker returned, if it is a UUID; otherwise a 400. */
export function parseProjectId(candidate: unknown): string {
  const parsed = z.string().uuid().safeParse(candidate);
  if (!parsed.success) {
    throw new ServerFnError("BAD_REQUEST", "A valid project id is required", { issues: [{ path: "projectId", message: "Expected a UUID" }] });
  }
  return parsed.data;
}

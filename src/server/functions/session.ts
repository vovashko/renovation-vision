// Sessions on the server (T21).
//
// getSession: who the current request belongs to, from the Supabase session COOKIES (verified with
// getClaims). Never a 401: signed out is `{ user: null, profile: null }`. The root route's
// beforeLoad calls it (directly during SSR, as an RPC on the client when the session changes) and
// puts the result in the router context as `auth`; the route guards read it from there.
//
// getProjectAccess: the caller's per-project role (`project_members.role`) plus the project summary.
// The project layout's beforeLoad caches it in the query client and guards on it. RLS stays the
// real enforcement; this decides what to render and where to redirect.
import { z } from "zod";
import { authedFn, publicFn } from "../fn";
import { loadProjectAccess, loadSession } from "./session.server";

export type { ProjectAccess, ProjectRole, Session, SessionProfile, SessionUser } from "./session.server";

export const getSession = publicFn({ method: "GET" })
  .validator(z.void())
  .handler(async () => loadSession());

export const getProjectAccess = authedFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data, context }) => loadProjectAccess(context, data.projectId));

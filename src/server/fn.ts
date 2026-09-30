// The two server-function builders. Every server function starts from one of them (createServerFn
// is lint-restricted to src/server/fn.ts), so none can forget the boundary, auth or rate limit:
//
//   // src/server/functions/rename-project.ts
//   export const renameProject = authedFn({ method: "POST" })
//     .middleware([requireProjectRole((input: { projectId: string }) => input.projectId, "manager")])
//     .validator(z.object({ projectId: z.string().uuid(), name: z.string().trim().min(1).max(120) }))
//     .handler(async ({ data, context }) => {
//       const { error } = await context.supabase.from("projects").update({ name: data.name }).eq("id", data.projectId);
//       if (error) throw error; // → logged, 500 INTERNAL
//       return { ok: true };
//     });
//
// Conventions: always pass a zod schema to `.validator()` (400 BAD_REQUEST with `issues` on bad
// input); use `context.supabase` (RLS as the user) unless the function truly needs the admin client;
// throw `ServerFnError` for expected failures; return plain, serializable data.
import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "./middleware/auth";
import { serverFnBoundary } from "./middleware/boundary";
import { rateLimit } from "./middleware/rate-limit";

/**
 * For the rare function that anonymous visitors may call (e.g. accepting an invite link):
 * error boundary + logging + the default rate limit, keyed by client IP.
 */
export const publicFn = createServerFn().middleware([serverFnBoundary, rateLimit({ key: "default" })]);

/**
 * The default: error boundary + logging, then `requireUser` (401 without a valid Supabase access
 * token; context gets `user` and a per-request `supabase` client acting as that user), then the
 * default rate limit keyed by user id. Add requireAal2 / requireAccountType / requireProjectRole /
 * a stricter rateLimit with `.middleware([...])`.
 */
export const authedFn = createServerFn().middleware([serverFnBoundary, requireUser, rateLimit({ key: "default" })]);

// Server functions for change requests (T61; the `decisions` tables). The handler bodies live in decisions.server.ts.
//
//   createChangeRequest  manager: submits a request (RPC, 2FA in the database) and emails the project's clients
//   acceptChangeRequest  client: approves a request (RPC) and emails the project's managers
//
// Both send email, so they carry the strict `email` rate limit (5/min per user) on top of the default one.
// Reject / reopen / edit are plain RPCs from the browser (the database checks the role and the state).
import { z } from "zod";
import { authedFn } from "../fn";
import { requireProjectRole } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { acceptChangeRequestHandler, createChangeRequestHandler } from "./decisions.server";

const projectIdOf = (input: { projectId: string }) => input.projectId;

const createInput = z
  .object({
    projectId: z.string().uuid(),
    title: z.string().trim().min(1).max(160),
    description: z.string().max(5000),
    costDelta: z.number().finite().min(-1_000_000_000).max(1_000_000_000),
    daysDelta: z.number().int().min(-3650).max(3650),
    stageId: z.string().uuid().nullable(),
  })
  .refine((v) => v.costDelta !== 0 || v.daysDelta !== 0, { message: "A change request must change the cost or the days" });

export const createChangeRequest = authedFn({ method: "POST" })
  .middleware([requireProjectRole(projectIdOf, "manager"), rateLimit({ key: "email" })])
  .validator(createInput)
  .handler(async ({ data, context }) => createChangeRequestHandler(data, context));

export const acceptChangeRequest = authedFn({ method: "POST" })
  .middleware([requireProjectRole(projectIdOf, "client"), rateLimit({ key: "email" })])
  .validator(z.object({ projectId: z.string().uuid(), requestId: z.string().uuid() }))
  .handler(async ({ data, context }) => acceptChangeRequestHandler(data, context));

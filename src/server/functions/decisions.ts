// Server functions for investor decisions (#55). The handler bodies live in decisions.server.ts.
//
//   createDecision       manager: submits a case (RPC) and emails the project's investors
//   requestDecisionCode  investor: issues + emails the 6-digit code that confirms accepting a case
//   acceptDecision       investor: accepts with the code (verified by the database, see decisions.server.ts)
//
// All three send or burn emails/attempts, so they carry the strict `email` rate limit (5/min per user) on top
// of the default one. Reject / question / answer / reopen / edit are plain RPCs from the browser (RLS-checked
// state machine in the database); they need neither a secret nor an email.
import { z } from "zod";
import { authedFn } from "../fn";
import { requireProjectRole } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { acceptDecisionHandler, createDecisionHandler, requestDecisionCodeHandler } from "./decisions.server";

const projectIdOf = (input: { projectId: string }) => input.projectId;

const createDecisionInput = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().max(5000),
  costDelta: z.number().finite().min(-1_000_000_000).max(1_000_000_000),
  daysDelta: z.number().int().min(-3650).max(3650),
  photos: z.array(z.string().min(1).max(512)).min(1).max(10),
});

export const createDecision = authedFn({ method: "POST" })
  .middleware([requireProjectRole(projectIdOf, "manager"), rateLimit({ key: "email" })])
  .validator(createDecisionInput)
  .handler(async ({ data, context }) => createDecisionHandler(data, context));

const decisionRef = z.object({ projectId: z.string().uuid(), decisionId: z.string().uuid() });

export const requestDecisionCode = authedFn({ method: "POST" })
  .middleware([requireProjectRole(projectIdOf, "client"), rateLimit({ key: "email" })])
  .validator(decisionRef)
  .handler(async ({ data, context }) => requestDecisionCodeHandler(data, context));

export const acceptDecision = authedFn({ method: "POST" })
  .middleware([requireProjectRole(projectIdOf, "client"), rateLimit({ key: "email" })])
  .validator(decisionRef.extend({ code: z.string().regex(/^\d{6}$/) }))
  .handler(async ({ data, context }) => acceptDecisionHandler(data, context));

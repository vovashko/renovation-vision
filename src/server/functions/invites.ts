// Invite server functions (T40). The handler bodies and the mechanism (generateLink + our own email) are in
// invites.server.ts.
//
//   inviteMember      project manager: invites a client (the client card's email) or a manager (staff only)
//   resendInvite      project manager: a new link for a pending invitation
//   revokeInvite      project manager: withdraws a pending invitation
//   lookupInvite      anyone with the link: what the accept page shows (pending / expired / used / revoked / invalid)
//   renewInviteToken  anyone with the link: a fresh gotrue token when only gotrue's (shorter-lived) one expired
//
// Accepting is the `accept_invitation` RPC, called by the invitee from the browser once the link signed them in.
// Sending functions carry the `invite` and `email` rate limits; the public ones are limited per IP.
import { z } from "zod";
import { LOCALES } from "@/i18n/locale";
import { invitationRef, inviteMemberInput, tokenHashSchema } from "@/features/people/domain/invites";
import { authedFn, publicFn } from "../fn";
import { requireProjectRole } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import {
  inviteMemberHandler,
  lookupInviteHandler,
  renewInviteTokenHandler,
  resendInviteHandler,
  revokeInviteHandler,
} from "./invites.server";

export type { InviteLookup, InviteResult, RenewResult } from "./invites.server";

const projectIdOf = (input: { projectId: string }) => input.projectId;

export const inviteMember = authedFn({ method: "POST" })
  .middleware([requireProjectRole(projectIdOf, "manager"), rateLimit({ key: "invite" }), rateLimit({ key: "email" })])
  .validator(inviteMemberInput)
  .handler(async ({ data, context }) => inviteMemberHandler(data, context));

export const resendInvite = authedFn({ method: "POST" })
  .middleware([requireProjectRole(projectIdOf, "manager"), rateLimit({ key: "invite" }), rateLimit({ key: "email" })])
  .validator(invitationRef.extend({ locale: z.enum(LOCALES) }))
  .handler(async ({ data, context }) => resendInviteHandler(data, context));

export const revokeInvite = authedFn({ method: "POST" })
  .middleware([requireProjectRole(projectIdOf, "manager")])
  .validator(invitationRef)
  .handler(async ({ data, context }) => revokeInviteHandler(data, context));

const tokenInput = z.object({ tokenHash: tokenHashSchema });

export const lookupInvite = publicFn({ method: "POST" })
  .middleware([rateLimit({ key: "invite" })])
  .validator(tokenInput)
  .handler(async ({ data }) => lookupInviteHandler(data));

export const renewInviteToken = publicFn({ method: "POST" })
  .middleware([rateLimit({ key: "invite" })])
  .validator(tokenInput)
  .handler(async ({ data }) => renewInviteTokenHandler(data));

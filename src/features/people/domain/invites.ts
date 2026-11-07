// Invites (T40): pure rules and schemas shared by the browser and the invite server functions. No Supabase, no React.
import { z } from "zod";
import { LOCALES } from "@/i18n/locale";
import { emailSchema, newPasswordSchema } from "@/features/auth/domain/schemas";

/** How long an invite link stays valid (ours; renewed on resend). */
export const INVITE_TTL_DAYS = 7;

/** The privacy policy version an invitee accepts (`consents.version`, kind `privacy_policy`). */
export const PRIVACY_POLICY_VERSION = "2026-10-25";

export type InviteRole = "client" | "manager";

/** pending: can be accepted; the rest are the translated dead ends of the accept page. */
export type InviteStatus = "pending" | "expired" | "used" | "revoked" | "invalid";

type InviteState = { accepted_at: string | null; revoked_at: string | null; expires_at: string };

/** An invitation's state now; a missing row is `invalid`. Revoked wins over used, used over expired. */
export function inviteStatus(row: InviteState | null | undefined, now: Date = new Date()): InviteStatus {
  if (!row) return "invalid";
  if (row.revoked_at) return "revoked";
  if (row.accepted_at) return "used";
  if (new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
  return "pending";
}

/** The expiry of an invite sent at `now`. */
export const inviteExpiry = (now: Date = new Date()) => new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000);

/** gotrue's hashed invite token as it appears in `?token_hash=` (hex). Anything else can't be one of ours. */
export const tokenHashSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{32,128}$/i);

export const isTokenHash = (value: unknown): value is string => tokenHashSchema.safeParse(value).success;

/** `inviteMember`'s input (the server function validates it). */
export const inviteMemberInput = z.object({
  projectId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["client", "manager"]),
  /** The inviter's UI language, for the email. */
  locale: z.enum(LOCALES),
});

export type InviteMemberInput = z.input<typeof inviteMemberInput>;

export const invitationRef = z.object({ projectId: z.string().uuid(), invitationId: z.string().uuid() });

/** The "Invite a manager" fallback in the Add person sheet reuses the manager email field. */
export const inviteEmailSchema = z.object({ email: emailSchema });

const acceptBase = {
  fullName: z.string().trim().min(1, "common:form.required").max(120, "common:form.invalid"),
  locale: z.enum(LOCALES),
  privacy: z.literal(true, { message: "people:invite.accept.privacyRequired" }),
};

/** The accept-invite form. Someone already signed in as the invitee (a retry) keeps their password. */
export function acceptInviteSchema(needsPassword: boolean) {
  if (!needsPassword) return z.object({ ...acceptBase, password: z.string().optional(), confirm: z.string().optional() });
  return z
    .object({ ...acceptBase, password: newPasswordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "auth:password.mismatch" });
}

export type AcceptInviteValues = {
  fullName: string;
  locale: (typeof LOCALES)[number];
  privacy: true;
  password?: string;
  confirm?: string;
};

/** Hints the invite RPC and server functions raise, each with a `people:invite.errors.*` message. */
export const INVITE_ERRORS = [
  "invite_invalid",
  "invite_revoked",
  "invite_used",
  "invite_expired",
  "invite_email_mismatch",
  "invite_name_required",
  "invite_locale_invalid",
  "consent_required",
  "account_exists",
  "invite_not_project_client",
  "staff_required",
  "manager_is_project_client",
  "not_signed_in",
] as const;

export type InviteError = (typeof INVITE_ERRORS)[number];

export const isInviteError = (value: unknown): value is InviteError =>
  typeof value === "string" && (INVITE_ERRORS as readonly string[]).includes(value);

/** The dead-end statuses an error hint means on the accept page. */
export function statusForError(hint: string | undefined): Exclude<InviteStatus, "pending"> | null {
  switch (hint) {
    case "invite_invalid":
      return "invalid";
    case "invite_revoked":
      return "revoked";
    case "invite_used":
      return "used";
    case "invite_expired":
      return "expired";
    default:
      return null;
  }
}

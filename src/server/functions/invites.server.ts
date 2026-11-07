// Handler bodies for the invite server functions (functions/invites.ts), split out so they are directly
// unit-testable (the me.server.ts / media.server.ts pattern).
//
// The mechanism: `auth.admin.generateLink({ type: "invite" })` plus our own `invite` email (sendEmail → Brevo),
// not `auth.admin.inviteUserByEmail`. generateLink hands us gotrue's hashed invite token, so the email links to
// `<request origin>/accept-invite?token_hash=<token>&type=invite` (verifyOtp, no PKCE code verifier needed) and the
// `invitations` row can store sha256(token) to find itself again: the accept page tells pending, expired, used and
// withdrawn invitations apart before it spends the token. inviteUserByEmail returns no token, so the row couldn't be
// tied to its link. Either way gotrue creates the (unconfirmed) account at invite time, so T35's auth.users trigger
// grants a client access by email right away; accepting only sets the name, password, language and consent.
//
// gotrue's own token lives for the Auth "Email OTP expiration" (1 h by default), ours for INVITE_TTL_DAYS. When the
// link's token has expired at gotrue but the invitation hasn't, the accept page asks `renewInviteToken` for a fresh
// one (same link holder, same invitation), so an invite works for the whole week.
//
// The token is a credential: it is never stored (only its sha256), never logged, and the email is `sensitive`.
import { getRequestUrl } from "@tanstack/react-start/server";
import { isStaff } from "@/domain/account";
import { logger } from "@/lib/logger";
import { getAdminSupabase, type AdminSupabase } from "@/lib/supabase/admin";
import en from "@/features/people/i18n/en.json";
import pl from "@/features/people/i18n/pl.json";
import { inviteExpiry, inviteStatus, INVITE_TTL_DAYS, type InviteRole, type InviteStatus } from "@/features/people/domain/invites";
import type { Locale } from "@/i18n/locale";
import { loadAccountType } from "../auth.server";
import { ServerFnError } from "../errors";
import { sendEmail } from "../email/send-email.server";
import type { AuthContext } from "../middleware/auth";

const toHex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");

/** sha256(token) as hex: byte-for-byte what `accept_invitation` computes in SQL. */
export async function hashInviteToken(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

/** The app's public origin for the link: the origin of the (CSRF-checked, same-origin) request. */
function requestOrigin(): string {
  return getRequestUrl().origin;
}

export const inviteUrl = (origin: string, token: string) => `${origin}/accept-invite?token_hash=${encodeURIComponent(token)}&type=invite`;

const bad = (reason: string, message: string) => new ServerFnError("BAD_REQUEST", message, { reason });

type AccountState = { user_id: string; confirmed: boolean; invited: boolean; signed_in: boolean };

async function accountState(admin: AdminSupabase, email: string): Promise<AccountState | null> {
  const { data, error } = await admin.rpc("invite_account_state", { p_email: email });
  if (error) throw new Error(error.message);
  return (data as AccountState[] | null)?.[0] ?? null;
}

/**
 * A fresh gotrue invite token for `email`; the previous one stops working. The first call creates the unconfirmed
 * account, with `locale` in its user_metadata (gotrue ignores `data` for an existing account).
 */
async function issueToken(admin: AdminSupabase, email: string, locale?: Locale): Promise<string> {
  const options = locale ? { data: { locale } } : undefined;
  const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email, options });
  if (error) {
    if ((error as { code?: string }).code === "email_exists") throw bad("account_exists", "This email already has an account");
    throw new Error(`generateLink failed: ${error.message}`);
  }
  return data.properties.hashed_token;
}

type InvitationRow = {
  id: string;
  email: string;
  role: InviteRole;
  project_id: string | null;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

const ROW_COLUMNS = "id, email, role, project_id, invited_by, expires_at, accepted_at, revoked_at";

async function invitationByToken(admin: AdminSupabase, token: string): Promise<InvitationRow | null> {
  const { data, error } = await admin
    .from("invitations")
    .select(ROW_COLUMNS)
    .eq("token_hash", await hashInviteToken(token))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as InvitationRow | null) ?? null;
}

/** Creates the project's open invitation for the email, or renews the one there is (new token hash, role and expiry). */
async function saveInvitation(
  admin: AdminSupabase,
  row: { projectId: string; email: string; role: InviteRole; invitedBy: string; tokenHash: string; expiresAt: string },
): Promise<string> {
  const values = { role: row.role, invited_by: row.invitedBy, token_hash: row.tokenHash, expires_at: row.expiresAt };
  const open = () =>
    admin
      .from("invitations")
      .select("id")
      .eq("project_id", row.projectId)
      .eq("email", row.email)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .maybeSingle();
  const update = async (id: string) => {
    const { error } = await admin.from("invitations").update(values).eq("id", id);
    if (error) throw new Error(error.message);
    return id;
  };

  const existing = await open();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return update(existing.data.id);

  const inserted = await admin
    .from("invitations")
    .insert({ ...values, project_id: row.projectId, email: row.email })
    .select("id")
    .single();
  if (!inserted.error) return inserted.data.id;
  // Two invites at once: the other one won the one-open-invitation index; renew it instead.
  if (inserted.error.code === "23505") {
    const again = await open();
    if (again.data) return update(again.data.id);
  }
  throw new Error(inserted.error.message);
}

export type InviteMemberData = { projectId: string; email: string; role: InviteRole; locale: Locale };
export type InviteResult = { id: string; email: string; role: InviteRole; expiresAt: string };

/**
 * Invites someone with no account yet to the project, or sends a pending invitation again. The caller is one of the
 * project's managers (middleware). A manager invite also needs a staff account; a client invite must be for the
 * project's client contact email.
 */
export async function inviteMemberHandler(data: InviteMemberData, context: AuthContext): Promise<InviteResult> {
  const email = data.email.trim().toLowerCase();
  if (data.role === "manager") {
    if (!isStaff(await loadAccountType(context))) {
      throw new ServerFnError("FORBIDDEN", "Only manager accounts can invite managers", { reason: "staff_required" });
    }
  } else {
    // Read as the user (RLS): the project's client contact.
    const { data: link, error } = await context.supabase
      .from("project_contacts")
      .select("contact:contacts(email)")
      .eq("project_id", data.projectId)
      .eq("role", "client")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const clientEmail = (link as { contact: { email: string | null } | null } | null)?.contact?.email ?? null;
    if (clientEmail?.toLowerCase() !== email) throw bad("invite_not_project_client", "Invite the project's client from the client card");
  }

  const admin = getAdminSupabase();
  if ((await accountState(admin, email))?.confirmed) throw bad("account_exists", "This email already has an account");

  const token = await issueToken(admin, email, data.locale);
  const expiresAt = inviteExpiry().toISOString();
  const id = await saveInvitation(admin, {
    projectId: data.projectId,
    email,
    role: data.role,
    invitedBy: context.user.id,
    tokenHash: await hashInviteToken(token),
    expiresAt,
  });

  const [{ data: project }, { data: inviter }] = await Promise.all([
    context.supabase.from("projects").select("name").eq("id", data.projectId).maybeSingle(),
    context.supabase.from("profiles").select("full_name").eq("id", context.user.id).maybeSingle(),
  ]);
  const origin = requestOrigin();
  const s = (data.locale === "en" ? en : pl).email.invite;
  await sendEmail({
    to: email,
    template: "invite",
    locale: data.locale,
    params: {
      siteUrl: origin,
      inviteUrl: inviteUrl(origin, token),
      inviterName: inviter?.full_name || s.someone,
      projectName: project?.name ?? "",
      role: data.role,
      expiresInDays: INVITE_TTL_DAYS,
    },
  });
  return { id, email, role: data.role, expiresAt };
}

type InvitationRef = { projectId: string; invitationId: string };

/** The project's invitation as its manager sees it (RLS), or 404. */
async function readInvitation(ref: InvitationRef, context: AuthContext) {
  const { data, error } = await context.supabase
    .from("invitations")
    .select("id, email, role, accepted_at, revoked_at")
    .eq("id", ref.invitationId)
    .eq("project_id", ref.projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ServerFnError("NOT_FOUND", "Invitation not found");
  return data;
}

/** Sends a pending (or expired) invitation again: a new link, valid for another INVITE_TTL_DAYS. The old link stops working. */
export async function resendInviteHandler(ref: InvitationRef & { locale: Locale }, context: AuthContext): Promise<InviteResult> {
  const invitation = await readInvitation(ref, context);
  if (invitation.revoked_at) throw bad("invite_revoked", "This invitation was withdrawn");
  if (invitation.accepted_at) throw bad("invite_used", "This invitation was already accepted");
  return inviteMemberHandler({ projectId: ref.projectId, email: invitation.email, role: invitation.role, locale: ref.locale }, context);
}

/**
 * Withdraws a pending invitation (`revoke_invitation`, as the user: the database checks the manager). If the account
 * the invite created was never used and no other invitation is open for it, it is deleted too, so its link can't sign
 * anyone in and a client card goes back to "Waiting for an account".
 */
export async function revokeInviteHandler(ref: InvitationRef, context: AuthContext): Promise<{ ok: true }> {
  const invitation = await readInvitation(ref, context);
  const { data: revoked, error } = await context.supabase.rpc("revoke_invitation", { p_invitation: ref.invitationId });
  if (error) {
    if (error.code === "42501")
      throw new ServerFnError("FORBIDDEN", "Only the project's managers can do this", { reason: "not_project_manager" });
    throw new Error(error.message);
  }
  if (!revoked) throw bad("invite_used", "This invitation is no longer pending");

  try {
    const admin = getAdminSupabase();
    const state = await accountState(admin, invitation.email);
    if (state && state.invited && !state.confirmed && !state.signed_in) {
      const { count, error: countError } = await admin
        .from("invitations")
        .select("id", { count: "exact", head: true })
        .eq("email", invitation.email)
        .is("accepted_at", null)
        .is("revoked_at", null);
      if (countError) throw new Error(countError.message);
      if (!count) {
        const { error: deleteError } = await admin.auth.admin.deleteUser(state.user_id);
        if (deleteError) throw new Error(deleteError.message);
      }
    }
  } catch (e) {
    logger.error("invitation revoked but the unused account could not be removed", { invitationId: ref.invitationId, err: e });
  }
  return { ok: true };
}

export type InviteLookup =
  | { status: Exclude<InviteStatus, "pending"> }
  | { status: "pending"; email: string; role: InviteRole; projectName: string; inviterName: string };

/** What the accept page shows for a link. Only a pending invitation says who it is for. */
export async function lookupInviteHandler(data: { tokenHash: string }): Promise<InviteLookup> {
  const admin = getAdminSupabase();
  const row = await invitationByToken(admin, data.tokenHash);
  const status = inviteStatus(row);
  if (status !== "pending" || !row) return { status: status === "pending" ? "invalid" : status };
  const [{ data: project }, { data: inviter }] = await Promise.all([
    row.project_id ? admin.from("projects").select("name").eq("id", row.project_id).maybeSingle() : Promise.resolve({ data: null }),
    row.invited_by ? admin.from("profiles").select("full_name").eq("id", row.invited_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    status: "pending",
    email: row.email,
    role: row.role,
    projectName: project?.name ?? "",
    inviterName: inviter?.full_name ?? "",
  };
}

export type RenewResult =
  { status: "renewed"; tokenHash: string } | { status: "needs_sign_in" } | { status: Exclude<InviteStatus, "pending"> };

/**
 * A fresh gotrue token for a link whose invitation is still pending (gotrue's own token expired first). The old
 * token stops working. `needs_sign_in`: the account was already set up through this link (only the last step failed),
 * so the invitee signs in and comes back.
 */
export async function renewInviteTokenHandler(data: { tokenHash: string }): Promise<RenewResult> {
  const admin = getAdminSupabase();
  const row = await invitationByToken(admin, data.tokenHash);
  const status = inviteStatus(row);
  if (status !== "pending" || !row) return { status: status === "pending" ? "invalid" : status };
  if ((await accountState(admin, row.email))?.confirmed) return { status: "needs_sign_in" };

  let token: string;
  try {
    token = await issueToken(admin, row.email);
  } catch (e) {
    if (e instanceof ServerFnError && e.reason === "account_exists") return { status: "needs_sign_in" };
    throw e;
  }
  const { error } = await admin
    .from("invitations")
    .update({ token_hash: await hashInviteToken(token) })
    .eq("id", row.id);
  if (error) throw new Error(error.message);
  return { status: "renewed", tokenHash: token };
}

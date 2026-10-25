// Invite hooks (T40): the manager's side (send, resend, withdraw, the pending list) and the invitee's accept flow.
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { useLocale } from "@/i18n";
import type { Locale } from "@/i18n/locale";
import { authErrorCode } from "@/features/auth/domain/auth-errors";
import { inviteMember, lookupInvite, renewInviteToken, resendInvite, revokeInvite } from "@/server/functions/invites";
import { invitesRepo, type PendingInvitation } from "../data/invites.repo";
import { peopleRepo } from "../data/people.repo";
import { PRIVACY_POLICY_VERSION, isTokenHash, statusForError, type InviteRole, type InviteStatus } from "../domain/invites";
import { peopleErrorCode, usePeopleErrorText } from "./errors";

export type { PendingInvitation } from "../data/invites.repo";

export const inviteKeys = {
  pending: (projectId: string) => ["invitations", projectId] as const,
  lookup: (tokenHash: string) => ["invitationLookup", tokenHash] as const,
};

/** The project's open invitations (managers). */
export const usePendingInvites = (projectId: string, enabled = true) =>
  useQuery({ queryKey: inviteKeys.pending(projectId), queryFn: () => invitesRepo.listPending(projectId), enabled: enabled && !!projectId });

/** An invite changes the invitation list, and (through T35's trigger) the client contact's account and the members. */
const inviteInvalidate = (projectId: string) => [inviteKeys.pending(projectId), keys.members(projectId), keys.projectContacts(projectId)];

/**
 * "Add manager" in the Add person sheet: adds an existing manager account (`add_project_member`), or answers
 * `"no_account"` (no toast) so the sheet can offer an invite instead.
 */
export function useAddManager(projectId: string) {
  const { t } = useTranslation(["people"]);
  const errorText = usePeopleErrorText();
  return useMutationWithToast(
    async (vars: { email: string }): Promise<"added" | "no_account"> => {
      try {
        await peopleRepo.addMember(projectId, vars.email, "manager");
        return "added";
      } catch (error) {
        if (peopleErrorCode(error) === "account_not_found") return "no_account";
        throw error;
      }
    },
    {
      invalidate: [keys.members(projectId)],
      success: (vars, result) => (result === "added" ? t("team.added", { email: vars.email }) : ""),
      error: errorText,
    },
  );
}

/** Sends an invite with `role`: a client (the client card's email) or a manager (Add person, staff only). */
function useInviteMember(projectId: string, role: InviteRole) {
  const { t } = useTranslation(["people"]);
  const errorText = usePeopleErrorText();
  const locale = useLocale();
  return useMutationWithToast((vars: { email: string }) => inviteMember({ data: { projectId, email: vars.email, role, locale } }), {
    invalidate: inviteInvalidate(projectId),
    success: (vars) => t("invite.sent", { email: vars.email }),
    error: errorText,
  });
}

/** The client card's "Send invite" (the server checks it's the project's client contact email). */
export const useInviteClient = (projectId: string) => useInviteMember(projectId, "client");

/** The Add person sheet's manager invite (staff only, checked by the server). */
export const useInviteManager = (projectId: string) => useInviteMember(projectId, "manager");

export function useResendInvite(projectId: string) {
  const { t } = useTranslation(["people"]);
  const errorText = usePeopleErrorText();
  const locale = useLocale();
  return useMutationWithToast(
    (invitation: Pick<PendingInvitation, "id" | "email">) => resendInvite({ data: { projectId, invitationId: invitation.id, locale } }),
    {
      invalidate: inviteInvalidate(projectId),
      success: (invitation) => t("invite.resent", { email: invitation.email }),
      error: errorText,
    },
  );
}

export function useRevokeInvite(projectId: string) {
  const { t } = useTranslation(["people"]);
  const errorText = usePeopleErrorText();
  return useMutationWithToast(
    (invitation: Pick<PendingInvitation, "id" | "email">) => revokeInvite({ data: { projectId, invitationId: invitation.id } }),
    {
      invalidate: inviteInvalidate(projectId),
      success: (invitation) => t("invite.revoked", { email: invitation.email }),
      error: errorText,
    },
  );
}

/** What the accept page shows for a link (no request for something that can't be a token). */
export function useInviteLookup(tokenHash: string | null) {
  const valid = isTokenHash(tokenHash);
  return useQuery({
    queryKey: inviteKeys.lookup(tokenHash ?? ""),
    queryFn: async () => (valid ? lookupInvite({ data: { tokenHash: tokenHash! } }) : { status: "invalid" as const }),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** The signed-in account's email (a retry after a half-finished accept keeps its session). */
export const useSessionEmail = () =>
  useQuery({ queryKey: ["invitationSessionEmail"], queryFn: () => invitesRepo.sessionEmail(), staleTime: Infinity, retry: false });

export type AcceptInput = {
  tokenHash: string;
  /** The account is already signed in as the invitee: skip the token and keep the password. */
  signedIn: boolean;
  fullName: string;
  locale: Locale;
  password?: string;
};

export type AcceptOutcome =
  { status: "accepted"; projectId: string | null } | { status: Exclude<InviteStatus, "pending"> | "needs_sign_in" };

/** gotrue's answer for a token it no longer accepts (expired, or already spent). */
const linkRejected = (error: unknown) => ["otp_expired", "flow_state_expired", "flow_state_not_found"].includes(authErrorCode(error) ?? "");

/**
 * The accept sequence: sign in with the link's token (a fresh one if only gotrue's shorter-lived token expired), set
 * the password and user_metadata, then `accept_invitation`. A dead-end answer at any step becomes its status.
 */
export async function acceptInvite(input: AcceptInput): Promise<AcceptOutcome> {
  let token = input.tokenHash;
  if (!input.signedIn) {
    try {
      await invitesRepo.verifyLink(token);
    } catch (error) {
      if (!linkRejected(error)) throw error;
      const renewed = await renewInviteToken({ data: { tokenHash: token } });
      if (renewed.status !== "renewed") return { status: renewed.status };
      token = renewed.tokenHash;
      await invitesRepo.verifyLink(token);
    }
  }
  await invitesRepo.saveAccount({ password: input.signedIn ? undefined : input.password, fullName: input.fullName, locale: input.locale });
  try {
    const projectId = await invitesRepo.accept({
      tokenHash: token,
      fullName: input.fullName,
      locale: input.locale,
      privacyVersion: PRIVACY_POLICY_VERSION,
    });
    return { status: "accepted", projectId };
  } catch (error) {
    const status = statusForError(peopleErrorCode(error));
    if (status) return { status };
    throw error;
  }
}

/**
 * Runs `acceptInvite` with local state (not a TanStack mutation: signing in clears the query and mutation caches,
 * see AuthSync).
 */
export function useAcceptInvite() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submit = useCallback(async (input: AcceptInput): Promise<AcceptOutcome | null> => {
    setPending(true);
    setError(null);
    try {
      return await acceptInvite(input);
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setPending(false);
    }
  }, []);
  return { submit, pending, error };
}

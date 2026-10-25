import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { isServerFnError } from "@/server/errors";
import { PeopleRepoError } from "../data/people.repo";
import { isInviteError } from "../domain/invites";

const KNOWN = [
  "client_is_project_manager",
  "manager_is_project_client",
  "project_already_has_client",
  "client_email_in_use",
  "client_role_not_allowed",
  "manager_requires_staff_account",
  "client_name_required",
  "not_project_manager",
  "mfa_required",
  "account_not_found",
] as const;

/** The machine-readable code of an error: an RPC's `hint`, or a server function's `reason`. */
export function peopleErrorCode(error: unknown): string | undefined {
  if (error instanceof PeopleRepoError) return error.hint;
  if (isServerFnError(error)) return error.reason;
  return undefined;
}

/**
 * A translated message for an error from the client/member RPCs (`people:errors.*`) or the invite RPC and server
 * functions (`people:invite.errors.*`); the error's own message otherwise.
 */
export function usePeopleErrorText(): (error: Error) => string {
  const { t } = useTranslation(["people", "auth", "common"]);
  return useCallback(
    (error) => {
      const code = peopleErrorCode(error);
      if (code && (KNOWN as readonly string[]).includes(code)) return t(`people:errors.${code as (typeof KNOWN)[number]}`);
      if (isInviteError(code)) return t(`people:invite.errors.${code}`);
      if (isServerFnError(error)) return error.code === "RATE_LIMITED" ? t("auth:errors.rateLimited") : t("common:errors.generic");
      return error.message || t("common:errors.generic");
    },
    [t],
  );
}

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { PeopleRepoError } from "../data/people.repo";

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

/** A translated message for an error from the client/member RPCs (`people:errors.*`); the error's own message otherwise. */
export function usePeopleErrorText(): (error: Error) => string {
  const { t } = useTranslation(["people", "common"]);
  return useCallback(
    (error) => {
      const hint = error instanceof PeopleRepoError ? error.hint : undefined;
      if (hint && (KNOWN as readonly string[]).includes(hint)) return t(`people:errors.${hint as (typeof KNOWN)[number]}`);
      return error.message || t("common:errors.generic");
    },
    [t],
  );
}

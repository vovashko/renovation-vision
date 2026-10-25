import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { isServerFnError } from "@/server/errors";
import { translatedErrorKey } from "@/shared/i18n-error";
import { ChangeRequestRepoError } from "../data/change-requests.repo";

/** The machine-readable reason an error carries: a server function's `reason`, or an RPC's hint. */
export function changeRequestErrorKey(error: unknown): string | undefined {
  if (isServerFnError(error)) return error.reason;
  if (error instanceof ChangeRequestRepoError) return error.hint;
  return undefined;
}

const KNOWN = [
  "decision_locked",
  "decision_forbidden",
  "not_rejected",
  "reason_required",
  "no_change",
  "stage_other_project",
  "budget_negative",
  "mfa_required",
] as const;

/** A translated message for an error from the change-request RPCs / server functions; the error's own message otherwise. */
export function useChangeRequestErrorText(): (error: Error) => string {
  const { t } = useTranslation(["change-requests", "common"]);
  return useCallback(
    (error) => {
      const key = changeRequestErrorKey(error);
      if (key && (KNOWN as readonly string[]).includes(key)) return t(`change-requests:errors.${key as (typeof KNOWN)[number]}`);
      if (isServerFnError(error) && error.code === "RATE_LIMITED") return t("change-requests:errors.rate_limited");
      const translatedKey = translatedErrorKey(error);
      if (translatedKey) return (t as (k: string) => string)(translatedKey);
      return error.message || t("common:errors.generic");
    },
    [t],
  );
}

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { isServerFnError } from "@/server/errors";
import { DecisionRepoError } from "../data/decisions.repo";

/** The machine-readable reason an error carries: a server function's `reason`, or an RPC's hint. */
export function decisionErrorKey(error: unknown): string | undefined {
  if (isServerFnError(error)) return error.reason;
  if (error instanceof DecisionRepoError) return error.hint;
  return undefined;
}

const KNOWN = [
  "decision_locked",
  "decision_not_open",
  "decision_forbidden",
  "not_pending",
  "not_in_question",
  "not_rejected",
  "reason_required",
  "text_invalid",
  "photos_required",
  "too_many_photos",
  "photo_missing",
  "too_many_codes",
  "budget_negative",
  "no_email",
] as const;

/** A translated message for an error from the decisions RPCs / server functions (`decisions:errors.*`); the error's own message otherwise. */
export function useDecisionErrorText(): (error: Error) => string {
  const { t } = useTranslation(["decisions", "common"]);
  return useCallback(
    (error) => {
      const key = decisionErrorKey(error);
      if (key && (KNOWN as readonly string[]).includes(key)) return t(`decisions:errors.${key as (typeof KNOWN)[number]}`);
      if (isServerFnError(error) && error.code === "RATE_LIMITED") return t("decisions:errors.rate_limited");
      return error.message || t("common:errors.generic");
    },
    [t],
  );
}

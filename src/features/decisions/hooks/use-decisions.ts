import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { reencodeImage } from "@/features/media/domain/strip-exif";
import { shouldReencode } from "@/features/media/domain/upload";
import { acceptDecision, createDecision, requestDecisionCode } from "@/server/functions/decisions";
import type { Decision } from "@/lib/database.types";
import { decisionsRepo, type DecisionInput } from "../data/decisions.repo";
import { useDecisionErrorText } from "./errors";

/** The project's decisions, with signed photo URLs. Cached for 30 minutes at most: the URLs are long-lived. */
export const useDecisions = (projectId: string) =>
  useQuery({ queryKey: keys.decisions(projectId), queryFn: () => decisionsRepo.list(projectId), staleTime: 30_000 });

/** How many cases wait for the investor (the navigation badge); only fetched when `enabled` (clients). */
export const usePendingDecisionCount = (projectId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: keys.decisionCount(projectId ?? ""),
    queryFn: () => decisionsRepo.countPending(projectId!),
    enabled: enabled && !!projectId,
    staleTime: 30_000,
  });

export const useDecisionEvents = (projectId: string, decisionId: string) =>
  useQuery({ queryKey: keys.decisionEvents(projectId, decisionId), queryFn: () => decisionsRepo.events(decisionId) });

/** Every decision change refreshes the lists, counts and histories; accepting also moves the project's budget and end date. */
function decisionInvalidate(projectId: string, projectChanged = false) {
  return [
    keys.decisions(projectId),
    keys.notifications(projectId),
    ...(projectChanged ? [keys.project(projectId), keys.projects, keys.activity(projectId)] : []),
  ];
}

/** Strips EXIF/GPS and caps dimensions for a standard image (the media feature's hardening); HEIC is uploaded as-is. */
async function prepareFile(file: File): Promise<File> {
  return shouldReencode(file.type) ? (await reencodeImage(file)).file : file;
}

export type NewDecision = DecisionInput & { files: File[] };

/** Uploads the photos, then submits the case through the server function (which also emails the investors). */
export function useCreateDecision(projectId: string) {
  const { t } = useTranslation(["decisions"]);
  const errorText = useDecisionErrorText();
  return useMutationWithToast(
    async (input: NewDecision) => {
      const files = await Promise.all(input.files.map(prepareFile));
      const photos = await decisionsRepo.uploadPhotos(projectId, files);
      try {
        return await createDecision({
          data: {
            projectId,
            title: input.title,
            description: input.description,
            costDelta: input.cost_delta,
            daysDelta: input.days_delta,
            photos,
          },
        });
      } catch (e) {
        await decisionsRepo.removeObjects(photos);
        throw e;
      }
    },
    { invalidate: decisionInvalidate(projectId), success: t("decisions:toast.created"), error: errorText },
  );
}

export type DecisionEdit = { decision: Decision; input: DecisionInput; files: File[]; removePhotoIds: string[] };

/** Edits an open case: uploads the new photos, saves, then removes the objects of the photos the edit dropped. */
export function useUpdateDecision(projectId: string) {
  const { t } = useTranslation(["decisions"]);
  const errorText = useDecisionErrorText();
  return useMutationWithToast(
    async (edit: DecisionEdit) => {
      const files = await Promise.all(edit.files.map(prepareFile));
      const added = await decisionsRepo.uploadPhotos(projectId, files);
      try {
        const removedPaths = await decisionsRepo.update(edit.decision.id, edit.input, added, edit.removePhotoIds);
        await decisionsRepo.removeObjects(removedPaths);
      } catch (e) {
        await decisionsRepo.removeObjects(added);
        throw e;
      }
    },
    {
      invalidate: (edit) => [...decisionInvalidate(projectId), keys.decisionEvents(projectId, edit.decision.id)],
      success: t("decisions:toast.updated"),
      error: errorText,
    },
  );
}

type WithText = { decisionId: string; text: string };

export function useAskQuestion(projectId: string) {
  const { t } = useTranslation(["decisions"]);
  const errorText = useDecisionErrorText();
  return useMutationWithToast((vars: WithText) => decisionsRepo.ask(vars.decisionId, vars.text), {
    invalidate: decisionInvalidate(projectId),
    success: t("decisions:toast.questionSent"),
    error: errorText,
  });
}

export function useAnswerQuestion(projectId: string) {
  const { t } = useTranslation(["decisions"]);
  const errorText = useDecisionErrorText();
  return useMutationWithToast((vars: WithText) => decisionsRepo.answer(vars.decisionId, vars.text), {
    invalidate: decisionInvalidate(projectId),
    success: t("decisions:toast.answerSent"),
    error: errorText,
  });
}

export function useRejectDecision(projectId: string) {
  const { t } = useTranslation(["decisions"]);
  const errorText = useDecisionErrorText();
  return useMutationWithToast((vars: { decisionId: string; reason: string }) => decisionsRepo.reject(vars.decisionId, vars.reason), {
    invalidate: decisionInvalidate(projectId),
    success: t("decisions:toast.rejected"),
    error: errorText,
  });
}

export function useReopenDecision(projectId: string) {
  const { t } = useTranslation(["decisions"]);
  const errorText = useDecisionErrorText();
  return useMutationWithToast((decisionId: string) => decisionsRepo.reopen(decisionId), {
    invalidate: decisionInvalidate(projectId),
    success: t("decisions:toast.reopened"),
    error: errorText,
  });
}

/** Emails the investor a 6-digit code (server function, strictly rate limited). */
export function useRequestDecisionCode(projectId: string) {
  const { t } = useTranslation(["decisions"]);
  const errorText = useDecisionErrorText();
  return useMutationWithToast((decisionId: string) => requestDecisionCode({ data: { projectId, decisionId } }), {
    success: t("decisions:toast.codeSent"),
    error: errorText,
  });
}

/**
 * Accepts a case with the emailed code. The result is one of the database's statuses; only `ok` toasts here,
 * the dialog explains the others (wrong code, expired…) next to the field.
 */
export function useAcceptDecision(projectId: string) {
  const { t } = useTranslation(["decisions"]);
  const errorText = useDecisionErrorText();
  return useMutationWithToast((vars: { decisionId: string; code: string }) => acceptDecision({ data: { projectId, ...vars } }), {
    invalidate: (vars) => [...decisionInvalidate(projectId, true), keys.decisionEvents(projectId, vars.decisionId)],
    success: (_vars, res) => (res.result === "ok" ? t("decisions:toast.accepted") : ""),
    error: errorText,
  });
}

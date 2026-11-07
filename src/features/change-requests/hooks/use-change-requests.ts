import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { acceptChangeRequest, createChangeRequest } from "@/server/functions/decisions";
import type { ChangeRequest } from "@/lib/database.types";
import { changeRequestsRepo, type ChangeRequestInput } from "../data/change-requests.repo";
import { pendingByStage } from "../domain/status";
import { useChangeRequestErrorText } from "./errors";

export const useChangeRequests = (projectId: string) =>
  useQuery({ queryKey: keys.changeRequests(projectId), queryFn: () => changeRequestsRepo.list(projectId), staleTime: 30_000 });

/** How many requests wait for the client (the navigation badge); only fetched when `enabled` (clients). */
export const usePendingChangeRequestCount = (projectId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: keys.changeRequestCount(projectId ?? ""),
    queryFn: () => changeRequestsRepo.countPending(projectId!),
    enabled: enabled && !!projectId,
    staleTime: 30_000,
  });

/** Pending requests per linked stage id, for the stage rows' "Waiting for client approval" badge (T60). */
export function usePendingRequestsByStage(projectId: string): Record<string, number> {
  const { data } = useChangeRequests(projectId);
  return useMemo(() => pendingByStage(data ?? []), [data]);
}

export const useChangeRequestEvents = (projectId: string, requestId: string) =>
  useQuery({ queryKey: keys.changeRequestEvents(projectId, requestId), queryFn: () => changeRequestsRepo.events(requestId) });

/** Every change refreshes the lists, counts and histories; approving also moves the project's budget and end date. */
function invalidateFor(projectId: string, projectChanged = false) {
  return [
    keys.changeRequests(projectId),
    keys.notifications(projectId),
    ...(projectChanged ? [keys.project(projectId), keys.projects, keys.activity(projectId)] : []),
  ];
}

/** Submits a request through the server function (which also emails the clients). */
export function useCreateChangeRequest(projectId: string) {
  const { t } = useTranslation(["change-requests"]);
  const errorText = useChangeRequestErrorText();
  return useMutationWithToast(
    (input: ChangeRequestInput) =>
      createChangeRequest({
        data: {
          projectId,
          title: input.title,
          description: input.description,
          costDelta: input.cost_delta,
          daysDelta: input.days_delta,
          stageId: input.stage_id,
        },
      }),
    { invalidate: invalidateFor(projectId), success: t("change-requests:toast.created"), error: errorText },
  );
}

export function useUpdateChangeRequest(projectId: string) {
  const { t } = useTranslation(["change-requests"]);
  const errorText = useChangeRequestErrorText();
  return useMutationWithToast(
    (edit: { request: ChangeRequest; input: ChangeRequestInput }) => changeRequestsRepo.update(edit.request.id, edit.input),
    {
      invalidate: (edit) => [...invalidateFor(projectId), keys.changeRequestEvents(projectId, edit.request.id)],
      success: t("change-requests:toast.updated"),
      error: errorText,
    },
  );
}

export function useRejectChangeRequest(projectId: string) {
  const { t } = useTranslation(["change-requests"]);
  const errorText = useChangeRequestErrorText();
  return useMutationWithToast((vars: { requestId: string; reason: string }) => changeRequestsRepo.reject(vars.requestId, vars.reason), {
    invalidate: (vars) => [...invalidateFor(projectId), keys.changeRequestEvents(projectId, vars.requestId)],
    success: t("change-requests:toast.rejected"),
    error: errorText,
  });
}

export function useReopenChangeRequest(projectId: string) {
  const { t } = useTranslation(["change-requests"]);
  const errorText = useChangeRequestErrorText();
  return useMutationWithToast((requestId: string) => changeRequestsRepo.reopen(requestId), {
    invalidate: (requestId) => [...invalidateFor(projectId), keys.changeRequestEvents(projectId, requestId)],
    success: t("change-requests:toast.reopened"),
    error: errorText,
  });
}

/** Approves a request (server function: the RPC, then the managers' email). `already_accepted` counts as done. */
export function useAcceptChangeRequest(projectId: string) {
  const { t } = useTranslation(["change-requests"]);
  const errorText = useChangeRequestErrorText();
  return useMutationWithToast((requestId: string) => acceptChangeRequest({ data: { projectId, requestId } }), {
    invalidate: (requestId) => [...invalidateFor(projectId, true), keys.changeRequestEvents(projectId, requestId)],
    success: (_requestId, res) => t(`change-requests:toast.accept.${res.result}`),
    error: errorText,
  });
}

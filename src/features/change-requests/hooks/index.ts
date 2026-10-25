// The change-requests feature's hooks entry point: routes, other features and shared UI (the navigation badge)
// import from here (README → Architecture: cross-feature imports go through hooks/domain, never data/).
export {
  useChangeRequests,
  usePendingChangeRequestCount,
  usePendingRequestsByStage,
  useChangeRequestEvents,
  useCreateChangeRequest,
  useUpdateChangeRequest,
  useRejectChangeRequest,
  useReopenChangeRequest,
  useAcceptChangeRequest,
} from "./use-change-requests";
export { useChangeRequestErrorText } from "./errors";
export { useDeltaText } from "./use-delta-text";

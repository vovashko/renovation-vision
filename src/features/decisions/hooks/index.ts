// The decisions feature's hooks entry point: routes and shared UI (the navigation badge) import from here
// (README → Architecture: cross-feature imports go through hooks/domain, never data/).
export {
  useDecisions,
  usePendingDecisionCount,
  useDecisionEvents,
  useCreateDecision,
  useUpdateDecision,
  useAskQuestion,
  useAnswerQuestion,
  useRejectDecision,
  useReopenDecision,
  useRequestDecisionCode,
  useAcceptDecision,
} from "./use-decisions";
export { useDecisionErrorText } from "./errors";

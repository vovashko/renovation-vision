// The decision state machine as the UI sees it (the database enforces it: supabase/migrations/…investor_decisions.sql).
//
//   pending ──ask──▶ question ──answer──▶ pending
//   pending | question ──accept──▶ accepted (final)
//   pending | question ──reject──▶ rejected ──reopen──▶ pending
import type { Decision, DecisionEvent, DecisionEventKind, DecisionStatus } from "@/lib/database.types";

/** In the order the list groups them. `satisfies` keeps the list in step with the `decision_status` enum. */
export const DECISION_STATUSES = ["pending", "question", "accepted", "rejected"] as const satisfies readonly DecisionStatus[];

export const DECISION_EVENT_KINDS = [
  "submitted",
  "question",
  "answer",
  "accepted",
  "rejected",
  "reopened",
  "edited",
] as const satisfies readonly DecisionEventKind[];

/** Not decided yet: the investor can still accept or reject, the manager can still edit. */
export const isOpen = (status: DecisionStatus) => status === "pending" || status === "question";

/** The manager edits only until the investor has decided (a decided case is locked: submit a new one). */
export const canEdit = isOpen;
/** The investor can accept or reject while the case is open. */
export const canDecide = isOpen;
/** A question can be asked while the case awaits the decision (not while one is already open). */
export const canAsk = (status: DecisionStatus) => status === "pending";
/** The manager answers an open question. */
export const canAnswer = (status: DecisionStatus) => status === "question";
/** Only a rejected case can be reopened (accepted is final). */
export const canReopen = (status: DecisionStatus) => status === "rejected";

/** Cases waiting for the investor's decision ('Oczekuje na decyzję'). */
export const pendingCount = (decisions: Pick<Decision, "status">[]) => decisions.filter((d) => d.status === "pending").length;

/** Cases the manager must answer. */
export const questionCount = (decisions: Pick<Decision, "status">[]) => decisions.filter((d) => d.status === "question").length;

/** Newest first within each status, statuses in the list's order (open ones before decided ones). */
export function sortDecisions<T extends Pick<Decision, "status" | "created_at">>(decisions: T[]): T[] {
  const rank = (s: DecisionStatus) => DECISION_STATUSES.indexOf(s);
  return [...decisions].sort((a, b) => rank(a.status) - rank(b.status) || b.created_at.localeCompare(a.created_at));
}

/** A history entry's body text only exists for some kinds (the question, the answer, the rejection reason). */
export const eventHasText = (event: Pick<DecisionEvent, "kind" | "text">) => event.text.trim() !== "";

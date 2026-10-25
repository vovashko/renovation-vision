// The change-request state machine as the UI sees it, and the selectors the pages use. Pure: no React, no
// Supabase. The database enforces the rules (supabase/migrations/…_change_requests.sql):
//
//   pending ──approve (client)──▶ accepted (final)
//   pending ──reject (client, reason)──▶ rejected ──reopen (either side)──▶ pending
//
// `question` is a leftover enum value from the bug-bash decisions: the migration moved every such row back to
// pending and nothing writes it any more; the UI treats it like pending so an old row never gets stuck.
import type { ChangeRequest, ChangeRequestEvent, ChangeRequestStatus } from "@/lib/database.types";

/** Waiting for the client: they can approve or reject it, the manager can still edit it. */
export const isPending = (status: ChangeRequestStatus) => status === "pending" || status === "question";

export const canEdit = isPending;
export const canDecide = isPending;
/** Only a rejected request can be reopened (approved is final). */
export const canReopen = (status: ChangeRequestStatus) => status === "rejected";

/** Where a list shows requests: Budget lists cost changes, Progress lists day changes (a request with both is in both). */
export type ChangeRequestPlace = "budget" | "progress";

export function inPlace<T extends Pick<ChangeRequest, "cost_delta" | "days_delta">>(requests: T[], place: ChangeRequestPlace): T[] {
  return requests.filter((r) => (place === "budget" ? r.cost_delta !== 0 : r.days_delta !== 0));
}

/** The page a request is listed on: Budget unless it only changes the days. */
export const homeOf = (request: Pick<ChangeRequest, "cost_delta" | "days_delta">): ChangeRequestPlace =>
  request.cost_delta === 0 && request.days_delta !== 0 ? "progress" : "budget";

type Sortable = Pick<ChangeRequest, "status" | "created_at" | "decided_at">;

/**
 * "Awaiting your approval" first (newest first), then the history (most recently decided first).
 */
export function groupRequests<T extends Sortable>(requests: T[]): { pending: T[]; history: T[] } {
  const pending = requests.filter((r) => isPending(r.status)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const history = requests
    .filter((r) => !isPending(r.status))
    .sort((a, b) => (b.decided_at ?? b.created_at).localeCompare(a.decided_at ?? a.created_at));
  return { pending, history };
}

/** How many requests wait for the client. */
export const pendingCount = (requests: Pick<ChangeRequest, "status">[]) => requests.filter((r) => isPending(r.status)).length;

/** Pending requests per linked stage id (T60 shows "Waiting for client approval" on those stages). */
export function pendingByStage(requests: Pick<ChangeRequest, "status" | "stage_id">[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of requests) if (r.stage_id && isPending(r.status)) out[r.stage_id] = (out[r.stage_id] ?? 0) + 1;
  return out;
}

/** The client overview's "Awaiting your approval" card: the count and the newest few. Null when nothing waits. */
export function approvalsCard<T extends Pick<ChangeRequest, "status" | "created_at">>(
  requests: T[],
  limit = 3,
): { count: number; newest: T[] } | null {
  const pending = requests.filter((r) => isPending(r.status)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return pending.length ? { count: pending.length, newest: pending.slice(0, limit) } : null;
}

/** A history entry's body text only exists for some kinds (a rejection reason, an old question or answer). */
export const eventHasText = (event: Pick<ChangeRequestEvent, "kind" | "text">) => event.text.trim() !== "";

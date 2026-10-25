// The only module in features/change-requests that imports supabase-js. Reads are plain selects (RLS: the
// project's managers and clients). Every change is an RPC: the database owns the state machine, the history
// and the notifications (supabase/migrations/…_change_requests.sql). Submitting and approving go through
// server functions instead (they also email the other side), see ../hooks.
import { supabase } from "@/lib/supabase";
import type { ChangeRequest, ChangeRequestEvent } from "@/lib/database.types";

/** An error from the database; `hint` is the machine-readable code an RPC raised (e.g. `decision_locked`). */
export class ChangeRequestRepoError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}

type Result<T> = { data: T | null; error: { message: string; hint?: string | null } | null };

async function must<T>(p: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new ChangeRequestRepoError(error.message, error.hint ?? undefined);
  return data as T;
}

export type ChangeRequestInput = {
  title: string;
  description: string;
  cost_delta: number;
  days_delta: number;
  stage_id: string | null;
};

const COLUMNS =
  "id, project_id, title, description, cost_delta, days_delta, stage_id, status, created_by, created_at, updated_at, decided_by, decided_at, decision_reason, pending_since";

type Row = Omit<ChangeRequest, "cost_delta"> & { cost_delta: number | string };

/** `numeric` may arrive as a string; the app always wants a number. */
export const mapChangeRequest = (row: Row): ChangeRequest => ({ ...row, cost_delta: Number(row.cost_delta) });

export const changeRequestsRepo = {
  async list(projectId: string): Promise<ChangeRequest[]> {
    const rows = await must(
      supabase.from("decisions").select(COLUMNS).eq("project_id", projectId).order("created_at", { ascending: false }),
    );
    return (rows as unknown as Row[]).map(mapChangeRequest);
  },

  /** How many requests wait for the client (the navigation badge); no rows are fetched. */
  async countPending(projectId: string): Promise<number> {
    const { count, error } = await supabase
      .from("decisions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "pending");
    if (error) throw new ChangeRequestRepoError(error.message, error.hint ?? undefined);
    return count ?? 0;
  },

  async events(requestId: string): Promise<ChangeRequestEvent[]> {
    return (await must(
      supabase
        .from("decision_events")
        .select("id, decision_id, kind, actor_id, actor_role, text, created_at")
        .eq("decision_id", requestId)
        .order("id", { ascending: true }),
    )) as ChangeRequestEvent[];
  },

  /** Saves an edit while the request is pending (manager, 2FA). */
  async update(requestId: string, input: ChangeRequestInput): Promise<void> {
    await must(
      supabase.rpc("update_decision", {
        p_decision: requestId,
        p_title: input.title,
        p_description: input.description,
        p_cost_delta: input.cost_delta,
        p_days_delta: input.days_delta,
        p_stage: input.stage_id ?? undefined,
      }),
    );
  },

  async reject(requestId: string, reason: string): Promise<void> {
    await must(supabase.rpc("reject_decision", { p_decision: requestId, p_reason: reason }));
  },

  async reopen(requestId: string): Promise<void> {
    await must(supabase.rpc("reopen_decision", { p_decision: requestId }));
  },
};

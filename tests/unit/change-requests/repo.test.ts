import { beforeEach, describe, expect, it, vi } from "vitest";

type Res = { data: unknown; error: { message: string; hint?: string | null } | null; count?: number | null };

// A chainable fake query builder: awaiting it resolves to the configured result (supabase-js builders are thenables).
function makeQuery(result: Res = { data: null, error: null }) {
  const calls: [string, unknown[]][] = [];
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order"]) {
    q[method] = vi.fn((...args: unknown[]) => (calls.push([method, args]), q));
  }
  q.then = (resolve: (v: Res) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return { q, calls };
}

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args), rpc: (...args: unknown[]) => rpcMock(...args) },
}));

const { changeRequestsRepo, ChangeRequestRepoError } = await import("@/features/change-requests/data/change-requests.repo");

const PROJECT = "b0000000-0000-4000-8000-000000000001";

beforeEach(() => {
  fromMock.mockReset();
  rpcMock.mockReset();
});

describe("changeRequestsRepo", () => {
  it("lists a project's requests newest first, with numeric costs", async () => {
    const { q, calls } = makeQuery({ data: [{ id: "r1", cost_delta: "880.50", days_delta: 2, stage_id: null }], error: null });
    fromMock.mockReturnValue(q);
    const rows = await changeRequestsRepo.list(PROJECT);
    expect(fromMock).toHaveBeenCalledWith("decisions");
    expect(calls).toContainEqual(["eq", ["project_id", PROJECT]]);
    expect(calls).toContainEqual(["order", ["created_at", { ascending: false }]]);
    expect(String(calls.find(([m]) => m === "select")?.[1][0])).not.toContain("photos");
    expect(rows[0].cost_delta).toBe(880.5);
  });

  it("counts the pending requests without fetching rows", async () => {
    const { q, calls } = makeQuery({ data: null, error: null, count: 3 });
    fromMock.mockReturnValue(q);
    await expect(changeRequestsRepo.countPending(PROJECT)).resolves.toBe(3);
    expect(calls).toContainEqual(["select", ["id", { count: "exact", head: true }]]);
    expect(calls).toContainEqual(["eq", ["status", "pending"]]);
  });

  it("edits, rejects and reopens through the RPCs", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await changeRequestsRepo.update("r1", { title: "T", description: "D", cost_delta: -5, days_delta: 1, stage_id: "s1" });
    await changeRequestsRepo.update("r1", { title: "T", description: "", cost_delta: 5, days_delta: 0, stage_id: null });
    await changeRequestsRepo.reject("r1", "Too much");
    await changeRequestsRepo.reopen("r1");
    expect(rpcMock.mock.calls).toEqual([
      ["update_decision", { p_decision: "r1", p_title: "T", p_description: "D", p_cost_delta: -5, p_days_delta: 1, p_stage: "s1" }],
      ["update_decision", { p_decision: "r1", p_title: "T", p_description: "", p_cost_delta: 5, p_days_delta: 0, p_stage: undefined }],
      ["reject_decision", { p_decision: "r1", p_reason: "Too much" }],
      ["reopen_decision", { p_decision: "r1" }],
    ]);
  });

  it("keeps the RPC's hint on errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "locked", hint: "decision_locked" } });
    const error = await changeRequestsRepo.reject("r1", "x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ChangeRequestRepoError);
    expect(error).toMatchObject({ hint: "decision_locked" });
  });
});

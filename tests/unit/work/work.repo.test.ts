import { describe, it, expect, vi, beforeEach } from "vitest";

// A minimal fluent mock of the supabase-js query builder: every method returns itself and it
// resolves like a PostgREST response (`{ data, error }`) once awaited.
function makeQuery(result: { data: unknown; error: { message: string } | null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  const builder: Record<string, unknown> = {
    select: record("select"),
    eq: record("eq"),
    order: record("order"),
    single: record("single"),
    update: record("update"),
    insert: record("insert"),
    delete: record("delete"),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return { builder, calls };
}

const from = vi.fn();
vi.mock("@/lib/supabase", () => ({ supabase: { from: (...args: unknown[]) => from(...args) } }));

const { workRepo } = await import("@/features/work/data/work.repo");

beforeEach(() => {
  from.mockReset();
});

describe("workRepo.listStages", () => {
  it("selects stages with their nested tasks, ordered, for the given project", async () => {
    const tasks = [{ id: "t1", name: "Tile floor", done: false }];
    const stages = [{ id: "s1", project_id: "p1", name: "Demolition", tasks }];
    const { builder, calls } = makeQuery({ data: stages, error: null });
    from.mockReturnValue(builder);

    const result = await workRepo.listStages("p1");

    expect(from).toHaveBeenCalledWith("stages");
    expect(result).toBe(stages);
    expect(result[0].tasks).toEqual(tasks);
    expect(calls.find((c) => c.method === "select")?.args[0]).toBe("*, tasks(*)");
    expect(calls.find((c) => c.method === "eq")?.args).toEqual(["project_id", "p1"]);
    // Sorted by the stage's own sort_order, then by each stage's tasks' sort_order.
    expect(calls.filter((c) => c.method === "order")).toHaveLength(2);
  });

  it("throws the Postgres error message when the query fails", async () => {
    const { builder } = makeQuery({ data: null, error: { message: "boom" } });
    from.mockReturnValue(builder);

    await expect(workRepo.listStages("p1")).rejects.toThrow("boom");
  });
});

describe("workRepo.saveStage", () => {
  it("inserts a new stage with the project id when there is no id", async () => {
    const { builder, calls } = makeQuery({ data: null, error: null });
    from.mockReturnValue(builder);

    await workRepo.saveStage("p1", { name: "Flooring" });

    expect(calls.find((c) => c.method === "insert")?.args[0]).toEqual({ name: "Flooring", project_id: "p1" });
  });

  it("updates an existing stage by id, without the id in the patch", async () => {
    const { builder, calls } = makeQuery({ data: null, error: null });
    from.mockReturnValue(builder);

    await workRepo.saveStage("p1", { id: "s1", name: "Flooring" });

    expect(calls.find((c) => c.method === "update")?.args[0]).toEqual({ name: "Flooring" });
    expect(calls.find((c) => c.method === "eq")?.args).toEqual(["id", "s1"]);
  });
});

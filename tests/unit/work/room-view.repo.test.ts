import { describe, it, expect, vi, beforeEach } from "vitest";

// A fluent mock of the supabase-js query builder: every method returns itself and it resolves like a PostgREST
// response once awaited. Each `from(table)` call gets the next queued result for that table.
type Res = { data: unknown; error: { message: string } | null };
const h = vi.hoisted(() => ({
  queue: {} as Record<string, unknown[]>,
  calls: [] as { table: string; method: string; args: unknown[] }[],
  rpc: vi.fn(),
}));

function builder(table: string, result: Res) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "single", "update", "insert", "delete"]) {
    b[method] = (...args: unknown[]) => {
      h.calls.push({ table, method, args });
      return b;
    };
  }
  b.then = (resolve: (v: Res) => unknown, reject?: (r: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return b;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => builder(table, (h.queue[table]?.shift() as Res) ?? { data: null, error: null }),
    rpc: (...args: unknown[]) => h.rpc(...args),
  },
}));

const { roomViewRepo } = await import("@/features/work/data/room-view.repo");

const ok = (data: unknown): Res => ({ data, error: null });
const callsOn = (table: string, method: string) => h.calls.filter((c) => c.table === table && c.method === method);

beforeEach(() => {
  h.queue = {};
  h.calls = [];
  h.rpc.mockReset();
});

describe("roomViewRepo.listRoomTasks", () => {
  it("reads the tasks tagged with the room, in checklist order", async () => {
    const tasks = [{ id: "t1", room_id: "r1", stage_id: null }];
    h.queue.tasks = [ok(tasks)];
    expect(await roomViewRepo.listRoomTasks("r1")).toBe(tasks);
    expect(callsOn("tasks", "eq")[0].args).toEqual(["room_id", "r1"]);
    expect(callsOn("tasks", "order")).toHaveLength(2);
  });
});

describe("roomViewRepo.listRoomMaterials", () => {
  it("goes through room_materials(): the only material read that is safe for clients", async () => {
    const rows = [{ id: "m1", name: "Tiles" }];
    h.rpc.mockResolvedValue(ok(rows));
    expect(await roomViewRepo.listRoomMaterials("r1")).toBe(rows);
    expect(h.rpc).toHaveBeenCalledWith("room_materials", { p_room: "r1" });
    expect(h.calls.filter((c) => c.table === "materials")).toHaveLength(0);
  });

  it("throws the Postgres error message", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(roomViewRepo.listRoomMaterials("r1")).rejects.toThrow("boom");
  });
});

describe("roomViewRepo.saveMaterial", () => {
  const input = { name: "Tiles", quantity: 2, unit: "m2", status: "ordered" as const, order_by_date: null, delivery_date: "2026-05-20" };

  it("inserts into the project and room, without any price", async () => {
    await roomViewRepo.saveMaterial("p1", "r1", input);
    const insert = callsOn("materials", "insert")[0];
    expect(insert.args[0]).toEqual({ ...input, project_id: "p1", room_id: "r1" });
    expect(Object.keys(insert.args[0] as object)).not.toContain("unit_price");
  });

  it("updates by id", async () => {
    await roomViewRepo.saveMaterial("p1", "r1", { ...input, id: "m1" });
    expect(callsOn("materials", "update")[0].args[0]).toEqual(input);
    expect(callsOn("materials", "eq")[0].args).toEqual(["id", "m1"]);
  });
});

describe("roomViewRepo.listRoomWarnings", () => {
  it("flattens the linked material ids", async () => {
    h.queue.room_warnings = [
      ok([
        { id: "w1", room_id: "r1", text: "Late", room_warning_materials: [{ material_id: "m1" }, { material_id: "m2" }] },
        { id: "w2", room_id: "r1", text: "Other", room_warning_materials: [] },
      ]),
    ];
    const warnings = await roomViewRepo.listRoomWarnings("r1");
    expect(warnings.map((w) => [w.id, w.material_ids])).toEqual([
      ["w1", ["m1", "m2"]],
      ["w2", []],
    ]);
    expect(warnings[0]).not.toHaveProperty("room_warning_materials");
  });
});

describe("roomViewRepo.saveWarning", () => {
  it("creates the warning, then links its materials", async () => {
    h.queue.room_warnings = [ok({ id: "w9" })];
    await roomViewRepo.saveWarning("p1", "r1", { text: "Late", material_ids: ["m1", "m2"] });
    expect(callsOn("room_warnings", "insert")[0].args[0]).toEqual({ text: "Late", project_id: "p1", room_id: "r1" });
    expect(callsOn("room_warning_materials", "insert")[0].args[0]).toEqual([
      { warning_id: "w9", material_id: "m1" },
      { warning_id: "w9", material_id: "m2" },
    ]);
    expect(callsOn("room_warning_materials", "delete")).toHaveLength(0);
  });

  it("on edit, only unlinks the removed materials and links the added ones", async () => {
    h.queue.room_warning_materials = [ok([{ material_id: "m1" }, { material_id: "m2" }])];
    await roomViewRepo.saveWarning("p1", "r1", { id: "w1", text: "Updated", material_ids: ["m2", "m3"] });
    expect(callsOn("room_warnings", "update")[0].args[0]).toEqual({ text: "Updated" });
    expect(callsOn("room_warning_materials", "in")[0].args).toEqual(["material_id", ["m1"]]);
    expect(callsOn("room_warning_materials", "insert")[0].args[0]).toEqual([{ warning_id: "w1", material_id: "m3" }]);
  });
});

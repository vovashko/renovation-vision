import { beforeEach, describe, expect, it, vi } from "vitest";

type Res = { data: unknown; error: { message: string; hint?: string | null } | null; count?: number | null };

// A chainable fake query builder: awaiting it resolves to the configured result (supabase-js builders are thenables).
function makeQuery(result: Res = { data: null, error: null }) {
  const calls: [string, unknown[]][] = [];
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "insert", "update"]) {
    q[method] = vi.fn((...args: unknown[]) => (calls.push([method, args]), q));
  }
  q.then = (resolve: (v: Res) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return { q, calls };
}

const fromMock = vi.fn();
const rpcMock = vi.fn();
const uploadMock = vi.fn();
const removeMock = vi.fn();
const signMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
    storage: { from: () => ({ upload: uploadMock, remove: removeMock, createSignedUrls: signMock }) },
  },
  MEDIA_BUCKET: "project-media",
}));

const { decisionsRepo, DecisionRepoError, mapDecision, decisionPhotoPath } = await import("@/features/decisions/data/decisions.repo");

const PROJECT = "b0000000-0000-4000-8000-000000000001";

beforeEach(() => {
  fromMock.mockReset();
  rpcMock.mockReset();
  uploadMock.mockReset();
  removeMock.mockReset();
  signMock.mockReset();
});

const row = (over: Record<string, unknown> = {}) => ({
  id: "d1",
  project_id: PROJECT,
  title: "Extra socket",
  description: "",
  cost_delta: "880.00",
  days_delta: 4,
  status: "pending",
  created_by: "u1",
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
  decided_by: null,
  decided_at: null,
  decision_reason: "",
  photos: [
    { id: "p2", decision_id: "d1", storage_path: `${PROJECT}/decisions/b.jpg`, sort_order: 2 },
    { id: "p1", decision_id: "d1", storage_path: `${PROJECT}/decisions/a.jpg`, sort_order: 1 },
  ],
  ...over,
});

describe("mapDecision", () => {
  it("turns a numeric string into a number, keeps a negative one, orders photos and adds their signed URLs", () => {
    const urls = new Map([[`${PROJECT}/decisions/a.jpg`, "https://signed/a"]]);
    const d = mapDecision(row({ cost_delta: "-1200.50" }) as never, urls);
    expect(d.cost_delta).toBe(-1200.5);
    expect(d.photos.map((p) => [p.id, p.url])).toEqual([
      ["p1", "https://signed/a"],
      ["p2", ""], // a path that couldn't be signed has no URL
    ]);
  });
});

describe("decisionsRepo.list", () => {
  it("selects the project's cases with their photos, signs the URLs in one call and maps the rows", async () => {
    const { q, calls } = makeQuery({ data: [row()], error: null });
    fromMock.mockReturnValue(q);
    signMock.mockResolvedValue({
      data: [
        { path: `${PROJECT}/decisions/a.jpg`, signedUrl: "https://signed/a" },
        { path: `${PROJECT}/decisions/b.jpg`, signedUrl: "https://signed/b" },
      ],
      error: null,
    });
    const [d] = await decisionsRepo.list(PROJECT);
    expect(fromMock).toHaveBeenCalledWith("decisions");
    expect(calls).toContainEqual(["eq", ["project_id", PROJECT]]);
    expect(String(calls.find(([m]) => m === "select")![1][0])).toContain("decision_photos");
    expect(signMock).toHaveBeenCalledTimes(1);
    expect(d.cost_delta).toBe(880);
    expect(d.photos.map((p) => p.url)).toEqual(["https://signed/a", "https://signed/b"]);
  });

  it("skips signing when there are no photos", async () => {
    fromMock.mockReturnValue(makeQuery({ data: [], error: null }).q);
    await expect(decisionsRepo.list(PROJECT)).resolves.toEqual([]);
    expect(signMock).not.toHaveBeenCalled();
  });

  it("throws a DecisionRepoError carrying the database hint", async () => {
    fromMock.mockReturnValue(makeQuery({ data: null, error: { message: "nope", hint: "decision_locked" } }).q);
    const error = await decisionsRepo.list(PROJECT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DecisionRepoError);
    expect(error).toMatchObject({ message: "nope", hint: "decision_locked" });
  });
});

describe("decisionsRepo.countPending / events", () => {
  it("counts pending cases without fetching rows", async () => {
    const { q, calls } = makeQuery({ data: null, error: null, count: 3 });
    fromMock.mockReturnValue(q);
    await expect(decisionsRepo.countPending(PROJECT)).resolves.toBe(3);
    expect(calls).toContainEqual(["select", ["id", { count: "exact", head: true }]]);
    expect(calls).toContainEqual(["eq", ["status", "pending"]]);
  });

  it("reads a case's history oldest first", async () => {
    const { q, calls } = makeQuery({ data: [{ id: 1, kind: "submitted" }], error: null });
    fromMock.mockReturnValue(q);
    await expect(decisionsRepo.events("d1")).resolves.toEqual([{ id: 1, kind: "submitted" }]);
    expect(fromMock).toHaveBeenCalledWith("decision_events");
    expect(calls).toContainEqual(["order", ["id", { ascending: true }]]);
  });
});

describe("decisionsRepo RPCs: every change goes through the database's state machine", () => {
  beforeEach(() => rpcMock.mockResolvedValue({ data: null, error: null }));

  it("asks, answers, rejects and reopens with the right arguments", async () => {
    await decisionsRepo.ask("d1", "Is it final?");
    await decisionsRepo.answer("d1", "Yes.");
    await decisionsRepo.reject("d1", "Too expensive");
    await decisionsRepo.reopen("d1");
    expect(rpcMock.mock.calls).toEqual([
      ["ask_decision_question", { p_decision: "d1", p_text: "Is it final?" }],
      ["answer_decision_question", { p_decision: "d1", p_text: "Yes." }],
      ["reject_decision", { p_decision: "d1", p_reason: "Too expensive" }],
      ["reopen_decision", { p_decision: "d1" }],
    ]);
  });

  it("never updates a table directly", async () => {
    await decisionsRepo.reject("d1", "no");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("update returns the storage paths of the photos the edit removed", async () => {
    rpcMock.mockResolvedValue({ data: [`${PROJECT}/decisions/old.jpg`], error: null });
    const removed = await decisionsRepo.update("d1", { title: "T", description: "D", cost_delta: -5, days_delta: -1 }, ["new.jpg"], ["p1"]);
    expect(removed).toEqual([`${PROJECT}/decisions/old.jpg`]);
    expect(rpcMock).toHaveBeenCalledWith("update_decision", {
      p_decision: "d1",
      p_title: "T",
      p_description: "D",
      p_cost_delta: -5,
      p_days_delta: -1,
      p_add_photos: ["new.jpg"],
      p_remove_photos: ["p1"],
    });
  });

  it("surfaces a locked case as an error with the hint", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "A decided case is locked", hint: "decision_locked" } });
    await expect(decisionsRepo.update("d1", { title: "T", description: "", cost_delta: 0, days_delta: 0 }, [], [])).rejects.toMatchObject({
      hint: "decision_locked",
    });
  });
});

describe("decisionsRepo photos", () => {
  it("builds paths in the project's decisions folder, which the storage policy and the table's check key on", () => {
    expect(decisionPhotoPath(PROJECT, new File(["x"], "Kitchen.PNG"))).toMatch(new RegExp(`^${PROJECT}/decisions/[0-9a-f-]{36}\\.png$`));
  });

  it("uploads each file and returns the paths", async () => {
    uploadMock.mockResolvedValue({ data: {}, error: null });
    const paths = await decisionsRepo.uploadPhotos(PROJECT, [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
    ]);
    expect(paths).toHaveLength(2);
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(uploadMock.mock.calls[0][2]).toMatchObject({ upsert: false, contentType: "image/jpeg" });
  });

  it("removes what it already uploaded when a later upload fails", async () => {
    uploadMock.mockResolvedValueOnce({ data: {}, error: null }).mockResolvedValueOnce({ data: null, error: { message: "storage down" } });
    removeMock.mockResolvedValue({ data: null, error: null });
    await expect(
      decisionsRepo.uploadPhotos(PROJECT, [
        new File(["a"], "a.jpg", { type: "image/jpeg" }),
        new File(["b"], "b.jpg", { type: "image/jpeg" }),
      ]),
    ).rejects.toThrow("storage down");
    const firstPath = uploadMock.mock.calls[0][0] as string;
    expect(removeMock).toHaveBeenCalledWith([firstPath]);
  });
});

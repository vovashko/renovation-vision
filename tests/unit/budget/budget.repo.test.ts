import { describe, it, expect, vi, beforeEach } from "vitest";

// A chainable fake query builder: every call (select/eq/order/update/insert/delete/upsert/single)
// returns itself, and awaiting the builder resolves to the configured result — matching how
// supabase-js's PostgrestFilterBuilder is used as a thenable in budget.repo.ts.
function makeQueryBuilder(result: { data: unknown; error: { message: string } | null } = { data: null, error: null }) {
  const calls: string[] = [];
  const builder = {
    calls,
    select: vi.fn(() => (calls.push("select"), builder)),
    eq: vi.fn(() => (calls.push("eq"), builder)),
    order: vi.fn(() => (calls.push("order"), builder)),
    single: vi.fn(() => (calls.push("single"), builder)),
    update: vi.fn(() => (calls.push("update"), builder)),
    insert: vi.fn(() => (calls.push("insert"), builder)),
    delete: vi.fn(() => (calls.push("delete"), builder)),
    upsert: vi.fn(() => (calls.push("upsert"), builder)),
    then: (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const events: string[] = [];

function makeStorageBucket(
  opts: {
    uploadResult?: { data: unknown; error: { message: string } | null };
    removeResult?: { data: unknown; error: { message: string } | null };
    signResult?: { data: unknown; error: { message: string } | null };
  } = {},
) {
  return {
    upload: vi.fn((path: string) => {
      events.push(`upload:${path}`);
      return Promise.resolve(opts.uploadResult ?? { data: { path }, error: null });
    }),
    remove: vi.fn((paths: string[]) => {
      events.push(`remove:${paths.join(",")}`);
      return Promise.resolve(opts.removeResult ?? { data: paths, error: null });
    }),
    createSignedUrl: vi.fn(() =>
      Promise.resolve(opts.signResult ?? { data: { signedUrl: "https://signed.example/receipt" }, error: null }),
    ),
  };
}

const fromMock = vi.fn();
const storageFromMock = vi.fn();
const getUserMock = vi.fn(() => Promise.resolve({ data: { user: { id: "user-1" } } }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    storage: { from: (...args: unknown[]) => storageFromMock(...args) },
    auth: { getUser: () => getUserMock() },
  },
  INTERNAL_BUCKET: "project-internal",
}));

const { budgetRepo } = await import("@/features/budget/data/budget.repo");

beforeEach(() => {
  fromMock.mockReset();
  storageFromMock.mockReset();
  getUserMock.mockClear();
  events.length = 0;
});

describe("budgetRepo receipt path", () => {
  it("uploads under <project_id>/receipts/<uuid>.<ext>", async () => {
    const insertBuilder = makeQueryBuilder({ data: { id: "expense-1" }, error: null });
    fromMock.mockReturnValue(insertBuilder);
    const bucket = makeStorageBucket();
    storageFromMock.mockReturnValue(bucket);

    const file = new File(["hello"], "receipt.PNG", { type: "image/png" });
    await budgetRepo.saveExpense("11111111-1111-1111-1111-111111111111", {
      description: "Tiles",
      category: "Materials",
      amount: 10,
      spent_on: "2026-04-19",
      receiptFile: file,
    });

    expect(bucket.upload).toHaveBeenCalledTimes(1);
    const path = bucket.upload.mock.calls[0][0] as string;
    expect(path).toMatch(
      /^11111111-1111-1111-1111-111111111111\/receipts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    );
  });
});

describe("budgetRepo.deleteExpense", () => {
  const expense = {
    id: "expense-1",
    project_id: "proj-1",
    stage_id: null,
    category: "Materials",
    description: "Tiles",
    vendor: "",
    vendor_notes: "",
    amount: 10,
    spent_on: "2026-04-19",
    receipt_path: "proj-1/receipts/abc.png",
  };

  it("removes the receipt object only after the row delete succeeds", async () => {
    const deleteBuilder = makeQueryBuilder({ data: null, error: null });
    fromMock.mockReturnValue(deleteBuilder);
    const bucket = makeStorageBucket();
    storageFromMock.mockReturnValue(bucket);

    await budgetRepo.deleteExpense(expense);

    expect(deleteBuilder.delete).toHaveBeenCalledTimes(1);
    expect(bucket.remove).toHaveBeenCalledWith([expense.receipt_path]);
    expect(events).toEqual([`remove:${expense.receipt_path}`]);
  });

  it("does not remove the receipt object when the row delete fails", async () => {
    const deleteBuilder = makeQueryBuilder({ data: null, error: { message: "boom" } });
    fromMock.mockReturnValue(deleteBuilder);
    const bucket = makeStorageBucket();
    storageFromMock.mockReturnValue(bucket);

    await expect(budgetRepo.deleteExpense(expense)).rejects.toThrow("boom");

    expect(bucket.remove).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it("skips the storage call entirely when there is no receipt", async () => {
    const deleteBuilder = makeQueryBuilder({ data: null, error: null });
    fromMock.mockReturnValue(deleteBuilder);
    const bucket = makeStorageBucket();
    storageFromMock.mockReturnValue(bucket);

    await budgetRepo.deleteExpense({ ...expense, receipt_path: null });

    expect(bucket.remove).not.toHaveBeenCalled();
  });
});

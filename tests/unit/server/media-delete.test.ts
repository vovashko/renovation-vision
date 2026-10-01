// deletePhoto/deleteRender/deleteExpense: storage removal only after the row delete succeeds, a
// storage failure is logged but the call still succeeds (the row is gone), and a non-manager gets
// 403. The handler bodies are tested directly (the me.test.ts pattern); the 403 is tested by running
// the real, exported server functions' full middleware chain against a mocked request/Supabase, the
// same mocking approach as auth-middleware.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerFnError } from "@/server/errors";
import type { AuthContext } from "@/server/middleware/auth";
import { deletePhotoHandler, deleteRenderHandler } from "@/server/functions/media.server";
import { deleteExpenseHandler } from "@/server/functions/expenses.server";
import { runServerMiddleware } from "./run-middleware";

const PROJECT_ID = "b0000000-0000-4000-8000-000000000001";
const USER_ID = "a0000000-0000-4000-8000-000000000001";

const h = vi.hoisted(() => ({
  headers: {} as Record<string, string>,
  logLines: [] as Record<string, unknown>[],
  projectRoles: {} as Record<string, boolean>,
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => h.headers[name.toLowerCase()],
  getCookies: () => ({}),
  setCookie: () => {},
}));

vi.mock("@/lib/supabase/server", () => ({
  getJwtVerifier: () => ({
    auth: {
      getClaims: async () => ({
        data: { claims: { sub: USER_ID, role: "authenticated", email: "jonas@renovision.demo", aal: "aal1" } },
        error: null,
      }),
    },
  }),
  createServerSupabase: () => ({
    rpc: async (fn: string, args: { p_project: string }) => ({ data: h.projectRoles[`${fn}:${args.p_project}`] ?? false, error: null }),
  }),
}));

const { requireProjectRole } = await import("@/server/middleware/auth");

beforeEach(() => {
  h.headers = { authorization: "Bearer good.access.token" };
  h.logLines = [];
  h.projectRoles = {};
  vi.spyOn(console, "error").mockImplementation((line: string) => void h.logLines.push(JSON.parse(line)));
});

/** A minimal fake AuthContext.supabase: `.from(table)` returns one row for select, records delete/remove calls. */
function fakeSupabase(opts: {
  row: Record<string, unknown> | null;
  deleteError?: { message: string };
  storageError?: { message: string };
}) {
  const calls: string[] = [];
  const client = {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.row, error: null }) }) }) }),
      delete: () => ({
        eq: async (_col: string, id: string) => {
          calls.push(`delete:${table}:${id}`);
          return { data: null, error: opts.deleteError ?? null };
        },
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          calls.push(`remove:${bucket}:${paths.join(",")}`);
          return { data: null, error: opts.storageError ?? null };
        },
      }),
    },
  };
  return { client, calls };
}

function contextWith(supabase: unknown): AuthContext {
  return { user: { id: "u1", email: null, aal: "aal1", role: "authenticated" }, supabase } as unknown as AuthContext;
}

describe("deletePhotoHandler", () => {
  it("removes the storage object only after the row delete succeeds, in that order", async () => {
    const { client, calls } = fakeSupabase({ row: { storage_path: `${PROJECT_ID}/photos/a.jpg` } });
    const result = await deletePhotoHandler({ projectId: PROJECT_ID, photoId: "photo-1" }, contextWith(client));
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual(["delete:photos:photo-1", `remove:project-media:${PROJECT_ID}/photos/a.jpg`]);
  });

  it("throws and never touches storage when the row delete fails", async () => {
    const { client, calls } = fakeSupabase({ row: { storage_path: "x.jpg" }, deleteError: { message: "db boom" } });
    await expect(deletePhotoHandler({ projectId: PROJECT_ID, photoId: "photo-1" }, contextWith(client))).rejects.toThrow("db boom");
    expect(calls).toEqual(["delete:photos:photo-1"]);
  });

  it("404s when the photo isn't found (wrong id, or not in this project)", async () => {
    const { client } = fakeSupabase({ row: null });
    const error = await deletePhotoHandler({ projectId: PROJECT_ID, photoId: "missing" }, contextWith(client)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServerFnError);
    expect(error).toMatchObject({ code: "NOT_FOUND" });
  });

  it("logs the orphan (with the path) and still returns success when storage removal fails", async () => {
    const { client } = fakeSupabase({ row: { storage_path: "proj/photos/orphan.jpg" }, storageError: { message: "storage down" } });
    const result = await deletePhotoHandler({ projectId: PROJECT_ID, photoId: "photo-2" }, contextWith(client));
    expect(result).toEqual({ ok: true }); // the row is gone either way
    expect(h.logLines).toHaveLength(1);
    expect(h.logLines[0]).toMatchObject({
      level: "error",
      msg: expect.stringContaining("orphan"),
      photoId: "photo-2",
      projectId: PROJECT_ID,
      path: "proj/photos/orphan.jpg",
    });
  });
});

describe("deleteRenderHandler", () => {
  it("removes the storage object only after the row delete succeeds", async () => {
    const { client, calls } = fakeSupabase({ row: { storage_path: `${PROJECT_ID}/renders/a.jpg` } });
    const result = await deleteRenderHandler({ projectId: PROJECT_ID, renderId: "render-1" }, contextWith(client));
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual(["delete:renders:render-1", `remove:project-media:${PROJECT_ID}/renders/a.jpg`]);
  });

  it("logs the orphan and still returns success when storage removal fails", async () => {
    const { client } = fakeSupabase({ row: { storage_path: "proj/renders/orphan.jpg" }, storageError: { message: "storage down" } });
    const result = await deleteRenderHandler({ projectId: PROJECT_ID, renderId: "render-2" }, contextWith(client));
    expect(result).toEqual({ ok: true });
    expect(h.logLines[0]).toMatchObject({ level: "error", renderId: "render-2", path: "proj/renders/orphan.jpg" });
  });
});

describe("deleteExpenseHandler", () => {
  it("removes the receipt only after the row delete succeeds", async () => {
    const { client, calls } = fakeSupabase({ row: { receipt_path: `${PROJECT_ID}/receipts/a.pdf` } });
    const result = await deleteExpenseHandler({ projectId: PROJECT_ID, expenseId: "exp-1" }, contextWith(client));
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual(["delete:expenses:exp-1", `remove:project-internal:${PROJECT_ID}/receipts/a.pdf`]);
  });

  it("skips the storage call entirely when there is no receipt", async () => {
    const { client, calls } = fakeSupabase({ row: { receipt_path: null } });
    const result = await deleteExpenseHandler({ projectId: PROJECT_ID, expenseId: "exp-2" }, contextWith(client));
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual(["delete:expenses:exp-2"]);
  });

  it("logs the orphan and still returns success when receipt removal fails", async () => {
    const { client } = fakeSupabase({ row: { receipt_path: "proj/receipts/orphan.pdf" }, storageError: { message: "storage down" } });
    const result = await deleteExpenseHandler({ projectId: PROJECT_ID, expenseId: "exp-3" }, contextWith(client));
    expect(result).toEqual({ ok: true });
    expect(h.logLines[0]).toMatchObject({ level: "error", expenseId: "exp-3", path: "proj/receipts/orphan.pdf" });
  });

  it("throws and never touches storage when the row delete fails", async () => {
    const { client, calls } = fakeSupabase({ row: { receipt_path: "x.pdf" }, deleteError: { message: "db boom" } });
    await expect(deleteExpenseHandler({ projectId: PROJECT_ID, expenseId: "exp-4" }, contextWith(client))).rejects.toThrow("db boom");
    expect(calls).toEqual(["delete:expenses:exp-4"]);
  });
});

// deletePhoto/deleteRender/deleteExpense are each built with
// `.middleware([requireProjectRole((input) => input.projectId, "manager")])` (see
// src/server/functions/{media,expenses}.ts) — exactly this gate, run for real against a mocked
// request/Supabase, the same mocking approach as auth-middleware.test.ts.
describe("the manager-only gate used by delete* server functions", () => {
  const managerOnly = requireProjectRole((input: { projectId: string }) => input.projectId, "manager");

  it("403s a caller who isn't a manager on this project", async () => {
    h.projectRoles[`is_project_manager:${PROJECT_ID}`] = false;
    const error = await runServerMiddleware([managerOnly], { data: { projectId: PROJECT_ID } }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServerFnError);
    expect(error).toMatchObject({ status: 403, code: "FORBIDDEN", reason: "project_manager_required" });
  });

  it("lets a manager on this project through", async () => {
    h.projectRoles[`is_project_manager:${PROJECT_ID}`] = true;
    const { handlerCalled, context } = await runServerMiddleware([managerOnly], { data: { projectId: PROJECT_ID } });
    expect(handlerCalled).toBe(true);
    expect(context.projectId).toBe(PROJECT_ID);
  });
});

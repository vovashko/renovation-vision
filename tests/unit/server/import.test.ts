// The spreadsheet-import server function (T45): auth and role gates, the RPC call shape (as the user, never the admin
// client), and how the RPCs' per-row errors come back. Handler bodies are tested directly (decisions.test.ts pattern).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerFnError } from "@/server/errors";
import type { AuthContext } from "@/server/middleware/auth";
import { runServerMiddleware } from "./run-middleware";

const PROJECT_ID = "b0000000-0000-4000-8000-000000000001";
const USER_ID = "a0000000-0000-4000-8000-000000000002";

const h = vi.hoisted(() => ({
  headers: {} as Record<string, string>,
  projectRoles: {} as Record<string, boolean>,
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => h.headers[name.toLowerCase()],
  getRequestUrl: () => new URL("https://app.renovision.test/projects/x/progress"),
  getCookies: () => ({}),
  setCookie: () => {},
}));

vi.mock("@/lib/supabase/server", () => ({
  getJwtVerifier: () => ({
    auth: {
      getClaims: async () => ({
        data: { claims: { sub: USER_ID, role: "authenticated", email: "pm@renovision.demo", aal: "aal2" } },
        error: null,
      }),
    },
  }),
  createServerSupabase: () => ({
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    rpc: async (fn: string, args: { p_project: string }) => ({ data: h.projectRoles[`${fn}:${args.p_project}`] ?? false, error: null }),
  }),
}));

// The admin client must never be used by the import: any call fails the test.
vi.mock("@/lib/supabase/admin", () => ({
  getAdminSupabase: () => {
    throw new Error("import must not use the admin client");
  },
}));

const { importRowsHandler, importRpcError } = await import("@/server/functions/import.server");
const { requireProjectRole, requireUser } = await import("@/server/middleware/auth");

beforeEach(() => {
  h.headers = { authorization: "Bearer good.access.token" };
  h.projectRoles = {};
});

type RpcResult = { data: unknown; error: { code?: string; message: string; details?: string | null } | null };
function contextWith(result: RpcResult) {
  const rpc = vi.fn(async (_fn: string, _args: unknown) => result);
  return {
    rpc,
    context: { user: { id: USER_ID, email: null, aal: "aal2", role: "authenticated" }, supabase: { rpc } } as unknown as AuthContext,
  };
}

const stageRows = [
  {
    name: "Demolition",
    start_date: "2026-03-02",
    end_date: "2026-03-13",
    client_note: "",
    tasks: [{ name: "Remove tiles", room: "Bathroom" }],
  },
];
const materialRows = [
  { name: "Tiles", quantity: 12.5, unit: "m2", unit_price: 89.9, status: "planned", stage: "", room: "Bathroom", supplier: "", notes: "" },
];

describe("importRowsHandler: the RPC call", () => {
  it("calls import_stages with the project and the rows, as the user", async () => {
    const { rpc, context } = contextWith({ data: { inserted_stages: 1, inserted_tasks: 1 }, error: null });
    const result = await importRowsHandler({ projectId: PROJECT_ID, kind: "stages", rows: stageRows }, context);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("import_stages", { p_project: PROJECT_ID, p_rows: stageRows });
    expect(result).toEqual({ kind: "stages", inserted: 1, insertedTasks: 1 });
  });

  it("calls import_materials with the project and the rows", async () => {
    const { rpc, context } = contextWith({ data: { inserted: 1 }, error: null });
    const result = await importRowsHandler({ projectId: PROJECT_ID, kind: "materials", rows: materialRows }, context);
    expect(rpc).toHaveBeenCalledWith("import_materials", { p_project: PROJECT_ID, p_rows: materialRows });
    expect(result).toEqual({ kind: "materials", inserted: 1, insertedTasks: 0 });
  });
});

describe("importRowsHandler: errors", () => {
  it("maps stage row errors (0-based) to issues with `<row>.<field>` paths", async () => {
    const details = JSON.stringify([
      { row: 0, field: "tasks[0].room", code: "room_not_found" },
      { row: 2, field: "end_date", code: "end_before_start" },
    ]);
    const { context } = contextWith({ data: null, error: { code: "22023", message: "import_stages: invalid rows", details } });
    await expect(importRowsHandler({ projectId: PROJECT_ID, kind: "stages", rows: stageRows }, context)).rejects.toMatchObject({
      status: 400,
      reason: "import_invalid_rows",
      issues: [
        { path: "0.tasks[0].room", message: "room_not_found" },
        { path: "2.end_date", message: "end_before_start" },
      ],
    });
  });

  it("maps material row errors (1-based in the RPC) to 0-based paths", async () => {
    const details = JSON.stringify([
      { row: 1, field: "room", message: "not_found" },
      { row: 3, field: "quantity", message: "not_a_number" },
    ]);
    const { context } = contextWith({ data: null, error: { code: "22023", message: "Invalid material rows: 2", details } });
    await expect(importRowsHandler({ projectId: PROJECT_ID, kind: "materials", rows: materialRows }, context)).rejects.toMatchObject({
      issues: [
        { path: "0.room", message: "not_found" },
        { path: "2.quantity", message: "not_a_number" },
      ],
    });
  });

  it("turns a non-manager / missing 2FA refusal into 403", async () => {
    const { context } = contextWith({ data: null, error: { code: "42501", message: "Two-factor verification required" } });
    const error = await importRowsHandler({ projectId: PROJECT_ID, kind: "materials", rows: materialRows }, context).catch((e) => e);
    expect(error).toBeInstanceOf(ServerFnError);
    expect(error).toMatchObject({ status: 403, reason: "import_forbidden" });
  });

  it("keeps an RPC rejection without row details as a 400, and hides other database errors behind a plain Error", () => {
    expect(importRpcError({ code: "22023", message: "import_stages: at most 500 rows at a time" }, "stages")).toMatchObject({
      status: 400,
      reason: "import_invalid",
    });
    const other = importRpcError({ code: "XX000", message: "boom" }, "stages");
    expect(other).not.toBeInstanceOf(ServerFnError);
  });
});

describe("the gates of importRows", () => {
  const managerOnly = requireProjectRole((input: { projectId: string }) => input.projectId, "manager");

  it("refuses a request without a session", async () => {
    h.headers = {};
    await expect(runServerMiddleware([requireUser], { data: { projectId: PROJECT_ID } })).rejects.toMatchObject({ status: 401 });
  });

  it("refuses a client, lets a manager through", async () => {
    h.projectRoles[`is_project_manager:${PROJECT_ID}`] = false;
    await expect(runServerMiddleware([managerOnly], { data: { projectId: PROJECT_ID } })).rejects.toMatchObject({
      status: 403,
      reason: "project_manager_required",
    });
    h.projectRoles[`is_project_manager:${PROJECT_ID}`] = true;
    expect((await runServerMiddleware([managerOnly], { data: { projectId: PROJECT_ID } })).handlerCalled).toBe(true);
  });
});

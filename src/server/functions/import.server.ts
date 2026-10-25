// Handler body of the spreadsheet-import server function (functions/import.ts), split out so it is directly
// unit-testable (the decisions.server.ts pattern). The browser has already parsed and validated the sheet;
// this re-checks the shape (zod, in import.ts) and calls the RPC AS THE USER (`context.supabase`), so RLS and the
// RPC's own checks (project manager, 2FA for materials, row validation, all-or-nothing) are what actually decide.
// Invalid rows come back as ServerFnError issues `{ path: "<0-based row>.<field>", message: <code> }`.
import { parseRpcDetail, toIssuePath } from "@/features/import/domain/rpc-errors";
import type { ImportKind } from "@/features/import/domain/types";
import { ServerFnError } from "../errors";
import type { AuthContext } from "../middleware/auth";

type PgError = { code?: string; message: string; details?: string | null };

export type ImportInput = { projectId: string; kind: ImportKind; rows: unknown[] };
export type ImportResult = { kind: ImportKind; inserted: number; insertedTasks: number };

const RPC = { stages: "import_stages", materials: "import_materials" } as const;

/** Turns a Postgres error from an import RPC into a ServerFnError. */
export function importRpcError(error: PgError, kind: ImportKind): Error {
  if (error.code === "42501") return new ServerFnError("FORBIDDEN", "You can't import into this project", { reason: "import_forbidden" });
  if (error.code === "22023") {
    const rows = parseRpcDetail(error.details, kind);
    if (rows?.length) {
      return new ServerFnError("BAD_REQUEST", "Some rows are invalid", {
        reason: "import_invalid_rows",
        issues: rows.map((r) => ({ path: toIssuePath(r), message: r.code })),
      });
    }
    return new ServerFnError("BAD_REQUEST", error.message, { reason: "import_invalid" });
  }
  return new Error(error.message);
}

/** Imports the rows as the signed-in manager: one RPC call, all or nothing. */
export async function importRowsHandler(data: ImportInput, context: AuthContext): Promise<ImportResult> {
  const { data: result, error } = await context.supabase.rpc(RPC[data.kind], { p_project: data.projectId, p_rows: data.rows as never });
  if (error) throw importRpcError(error, data.kind);
  const counts = (result ?? {}) as { inserted?: number; inserted_stages?: number; inserted_tasks?: number };
  return data.kind === "stages"
    ? { kind: "stages", inserted: counts.inserted_stages ?? 0, insertedTasks: counts.inserted_tasks ?? 0 }
    : { kind: "materials", inserted: counts.inserted ?? 0, insertedTasks: 0 };
}

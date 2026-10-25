// The import RPCs report invalid input as SQLSTATE 22023 with DETAIL = a JSON array of per-row problems:
//   import_stages:    [{ row: 0-based, field, code }]      field: "name" | "tasks[1].room" | null
//   import_materials: [{ row: 1-based, field, message }]
// The server turns that into ServerFnError issues `{ path: "<0-based index>.<field>", message: code }`, and the
// browser maps them back to sheet rows with the sources recorded at validation time. Pure; used on both sides.
import type { ImportIssue, ImportKind } from "./types";
import type { RowSource } from "./validate";

export type RpcRowIssue = { index: number; field: string | null; code: string };

/** Parses an RPC error DETAIL into 0-based row issues; undefined when it isn't the expected JSON. */
export function parseRpcDetail(detail: string | null | undefined, kind: ImportKind): RpcRowIssue[] | undefined {
  if (!detail) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(detail);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  const issues: RpcRowIssue[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const { row, field, code, message } = item as Record<string, unknown>;
    const code_ = typeof code === "string" ? code : typeof message === "string" ? message : "invalid";
    if (typeof row !== "number") continue;
    issues.push({ index: kind === "materials" ? row - 1 : row, field: typeof field === "string" ? field : null, code: code_ });
  }
  return issues;
}

export const toIssuePath = (issue: RpcRowIssue) => (issue.field ? `${issue.index}.${issue.field}` : String(issue.index));

/** The inverse of toIssuePath: undefined when the path isn't ours. */
export function fromIssuePath(path: string): { index: number; field: string | null } | undefined {
  const dot = path.indexOf(".");
  const index = Number(dot < 0 ? path : path.slice(0, dot));
  if (!Number.isInteger(index) || index < 0) return undefined;
  return { index, field: dot < 0 ? null : path.slice(dot + 1) };
}

/** Maps server issues back to sheet rows. A `tasks[j]...` field points at the sheet row of that task. */
export function issuesToSheet(issues: { path: string; message: string }[], sources: RowSource[]): ImportIssue[] {
  const out: ImportIssue[] = [];
  for (const issue of issues) {
    const where = fromIssuePath(issue.path);
    const source = where && sources[where.index];
    if (!where || !source) {
      out.push({ row: 1, field: null, code: issue.message });
      continue;
    }
    const task = where.field ? /^tasks\[(\d+)\](?:\.(\w+))?$/.exec(where.field) : null;
    if (task) {
      out.push({
        row: source.taskRows[Number(task[1])] ?? source.row,
        field: task[2] === "name" ? "task" : (task[2] ?? "task"),
        code: issue.message,
      });
    } else {
      out.push({ row: source.row, field: where.field, code: issue.message });
    }
  }
  return out;
}

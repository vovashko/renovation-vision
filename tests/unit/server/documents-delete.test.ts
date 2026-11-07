// deleteDocument: the storage object is removed only after the row delete succeeds, a storage failure is logged
// (with the path) but the call still succeeds, and an unknown document is a 404. The handler body is tested
// directly (the media-delete.test.ts pattern).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerFnError } from "@/server/errors";
import type { AuthContext } from "@/server/middleware/auth";
import { deleteDocumentHandler } from "@/server/functions/documents.server";

const PROJECT_ID = "b0000000-0000-4000-8000-000000000001";
const logLines: Record<string, unknown>[] = [];

beforeEach(() => {
  logLines.length = 0;
  vi.spyOn(console, "error").mockImplementation((line: string) => void logLines.push(JSON.parse(line)));
});

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

const contextWith = (supabase: unknown) =>
  ({ user: { id: "u1", email: null, aal: "aal2", role: "authenticated" }, supabase }) as unknown as AuthContext;

describe("deleteDocumentHandler", () => {
  it("removes the row first, then the storage object", async () => {
    const { client, calls } = fakeSupabase({ row: { storage_path: `${PROJECT_ID}/contract/a.pdf` } });
    const result = await deleteDocumentHandler({ projectId: PROJECT_ID, documentId: "doc-1" }, contextWith(client));
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual(["delete:documents:doc-1", `remove:project-documents:${PROJECT_ID}/contract/a.pdf`]);
  });

  it("throws and never touches storage when the row delete fails", async () => {
    const { client, calls } = fakeSupabase({ row: { storage_path: "x.pdf" }, deleteError: { message: "db boom" } });
    await expect(deleteDocumentHandler({ projectId: PROJECT_ID, documentId: "doc-1" }, contextWith(client))).rejects.toThrow("db boom");
    expect(calls).toEqual(["delete:documents:doc-1"]);
  });

  it("404s when the document isn't found (wrong id, or not in this project)", async () => {
    const { client, calls } = fakeSupabase({ row: null });
    const error = await deleteDocumentHandler({ projectId: PROJECT_ID, documentId: "missing" }, contextWith(client)).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ServerFnError);
    expect(error).toMatchObject({ code: "NOT_FOUND" });
    expect(calls).toEqual([]);
  });

  it("logs the orphan (with the path) and still succeeds when storage removal fails", async () => {
    const { client } = fakeSupabase({ row: { storage_path: "proj/contract/orphan.pdf" }, storageError: { message: "storage down" } });
    const result = await deleteDocumentHandler({ projectId: PROJECT_ID, documentId: "doc-2" }, contextWith(client));
    expect(result).toEqual({ ok: true }); // the row is gone either way
    expect(logLines).toHaveLength(1);
    expect(logLines[0]).toMatchObject({
      level: "error",
      msg: expect.stringContaining("orphan"),
      documentId: "doc-2",
      projectId: PROJECT_ID,
      path: "proj/contract/orphan.pdf",
    });
  });
});

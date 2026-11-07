// deleteDocument's handler body, split out so it is directly unit-testable (the same pattern as
// media.server.ts): delete the DB row first, then remove the storage object. A storage failure is logged
// (path and request id) as an orphan marker for manual cleanup, but the call still succeeds: the row is gone.
import { logger } from "@/lib/logger";
import { DOCUMENTS_BUCKET } from "@/lib/supabase";
import { ServerFnError } from "../errors";
import type { AuthContext } from "../middleware/auth";

export async function deleteDocumentHandler(data: { projectId: string; documentId: string }, context: AuthContext): Promise<{ ok: true }> {
  const { data: doc, error: selectError } = await context.supabase
    .from("documents")
    .select("storage_path")
    .eq("id", data.documentId)
    .eq("project_id", data.projectId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (!doc) throw new ServerFnError("NOT_FOUND", "Document not found");

  const { error: deleteError } = await context.supabase.from("documents").delete().eq("id", data.documentId);
  if (deleteError) throw deleteError;

  // The row is gone, so the object is an orphan, which the manager's storage policy lets them remove.
  const { error: storageError } = await context.supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);
  if (storageError) {
    logger.error("document row deleted but storage object removal failed (orphan)", {
      documentId: data.documentId,
      projectId: data.projectId,
      path: doc.storage_path,
      err: storageError,
    });
  }
  return { ok: true };
}

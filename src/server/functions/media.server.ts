// deletePhoto/deleteRender's handler bodies, split out so they're directly unit-testable (the same
// pattern as functions/me.server.ts): delete the DB row first, then remove the storage object. A
// storage failure is logged (with the path and request id, via the logger's automatic request
// context) as an orphan marker for manual cleanup, but the call still reports success — the row is
// gone, which is what the UI and the rest of the app care about.
import { logger } from "@/lib/logger";
import { MEDIA_BUCKET } from "@/lib/supabase";
import { ServerFnError } from "../errors";
import type { AuthContext } from "../middleware/auth";

export async function deletePhotoHandler(data: { projectId: string; photoId: string }, context: AuthContext): Promise<{ ok: true }> {
  const { data: photo, error: selectError } = await context.supabase
    .from("photos")
    .select("storage_path")
    .eq("id", data.photoId)
    .eq("project_id", data.projectId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (!photo) throw new ServerFnError("NOT_FOUND", "Photo not found");

  const { error: deleteError } = await context.supabase.from("photos").delete().eq("id", data.photoId);
  if (deleteError) throw deleteError;

  const { error: storageError } = await context.supabase.storage.from(MEDIA_BUCKET).remove([photo.storage_path]);
  if (storageError) {
    logger.error("photo row deleted but storage object removal failed (orphan)", {
      photoId: data.photoId,
      projectId: data.projectId,
      path: photo.storage_path,
      err: storageError,
    });
  }
  return { ok: true };
}

export async function deleteRenderHandler(data: { projectId: string; renderId: string }, context: AuthContext): Promise<{ ok: true }> {
  const { data: render, error: selectError } = await context.supabase
    .from("renders")
    .select("storage_path")
    .eq("id", data.renderId)
    .eq("project_id", data.projectId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (!render) throw new ServerFnError("NOT_FOUND", "Render not found");

  const { error: deleteError } = await context.supabase.from("renders").delete().eq("id", data.renderId);
  if (deleteError) throw deleteError;

  const { error: storageError } = await context.supabase.storage.from(MEDIA_BUCKET).remove([render.storage_path]);
  if (storageError) {
    logger.error("render row deleted but storage object removal failed (orphan)", {
      renderId: data.renderId,
      projectId: data.projectId,
      path: render.storage_path,
      err: storageError,
    });
  }
  return { ok: true };
}

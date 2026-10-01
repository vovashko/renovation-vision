// The only place in `features/media` that imports supabase-js. Ported from `src/lib/api.ts`'s
// photo/render methods (read-only reference — that file is shared across the W2c tasks and isn't
// edited here); the storage path convention (`<project_id>/photos/…`, `<project_id>/renders/…`) is
// kept exactly, since the RLS/storage policies depend on it.
import { supabase, MEDIA_BUCKET } from "@/lib/supabase";
import { fileExt } from "@/domain/text";
import type { Photo, Render } from "@/lib/database.types";

export type PhotoMeta = { stage_id: string | null; room_id: string | null; caption: string };
/** A file ready to upload, plus its EXIF capture date (null when it has none — the caller then uses "now"). */
export type PhotoUploadItem = { file: File; takenAt: string | null };
export type PhotoPatch = Partial<Pick<Photo, "caption" | "alt" | "stage_id" | "room_id" | "status">>;
export type RenderInput = Partial<Omit<Render, "project_id" | "url" | "storage_path">> & { file?: File | null };

type Result<T> = { data: T | null; error: { message: string } | null };

async function must<T>(p: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

/** Signed URLs for a batch of storage paths, keyed by path. A path whose URL can't be signed is left out. */
export async function signUrls(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const data = await must(supabase.storage.from(bucket).createSignedUrls(unique, 60 * 60));
  return new Map(data.filter((d) => d.signedUrl).map((d) => [d.path as string, d.signedUrl as string]));
}

/** Uploads a file to `bucket`/`path` and returns the path, for use as a table's `storage_path`. */
export async function upload(bucket: string, path: string, file: File): Promise<string> {
  await must(supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false }));
  return path;
}

/** `<project_id>/<folder>/<uuid>.<ext>`, the extension read from the file name (falls back to "jpg"). */
export function mediaPath(projectId: string, folder: string, file: File): string {
  return `${projectId}/${folder}/${crypto.randomUUID()}.${fileExt(file.name)}`;
}

async function listPhotos(projectId: string): Promise<Photo[]> {
  const rows = (await must(
    supabase.from("photos").select("*").eq("project_id", projectId).order("taken_at", { ascending: false }),
  )) as Photo[];
  const urls = await signUrls(
    MEDIA_BUCKET,
    rows.map((r) => r.storage_path),
  );
  return rows.map((r) => ({ ...r, url: urls.get(r.storage_path) ?? "" }));
}

/** Uploads already-processed files (re-encoded/EXIF-stripped where applicable — see features/media/domain). */
async function uploadPhotos(projectId: string, items: PhotoUploadItem[], meta: PhotoMeta, publish: boolean): Promise<void> {
  const uid = await currentUserId();
  const now = new Date().toISOString();
  for (const { file, takenAt } of items) {
    const path = await upload(MEDIA_BUCKET, mediaPath(projectId, "photos", file), file);
    await must(
      supabase.from("photos").insert({
        project_id: projectId,
        storage_path: path,
        stage_id: meta.stage_id,
        room_id: meta.room_id,
        caption: meta.caption,
        alt: meta.caption || file.name,
        uploaded_by: uid,
        status: publish ? "published" : "draft",
        published_at: publish ? now : null,
        taken_at: takenAt ?? now,
      }),
    );
  }
}

async function updatePhoto(photoId: string, patch: PhotoPatch): Promise<void> {
  const extra =
    patch.status === "published" ? { published_at: new Date().toISOString() } : patch.status === "draft" ? { published_at: null } : {};
  await must(
    supabase
      .from("photos")
      .update({ ...patch, ...extra })
      .eq("id", photoId),
  );
}

async function listRenders(projectId: string): Promise<Render[]> {
  const rows = (await must(supabase.from("renders").select("*").eq("project_id", projectId).order("sort_order"))) as Render[];
  const urls = await signUrls(
    MEDIA_BUCKET,
    rows.map((r) => r.storage_path),
  );
  return rows.map((r) => ({ ...r, url: urls.get(r.storage_path) ?? "" }));
}

async function saveRender(projectId: string, { id: renderId, file, ...input }: RenderInput): Promise<void> {
  const storage_path = file ? await upload(MEDIA_BUCKET, mediaPath(projectId, "renders", file), file) : undefined;
  if (renderId) {
    await must(
      supabase
        .from("renders")
        .update({ ...input, ...(storage_path ? { storage_path } : {}) })
        .eq("id", renderId),
    );
  } else {
    if (!storage_path) throw new Error("Choose an image for the render");
    await must(supabase.from("renders").insert({ ...input, storage_path, project_id: projectId }));
  }
}

/** The shared asset service for photos and renders: `features/media`'s only Supabase entry point.
 * Deletes go through the `deletePhoto`/`deleteRender` server functions instead (atomic row + storage
 * delete, RLS-checked as the user) — see features/media/hooks. */
export const mediaRepo = {
  signUrls,
  upload,
  mediaPath,
  listPhotos,
  uploadPhotos,
  updatePhoto,
  listRenders,
  saveRender,
};

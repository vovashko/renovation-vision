// The only place in `features/documents` that imports supabase-js. Files live in the private
// `project-documents` bucket at `<project_id>/<category>/<uuid>.<ext>` (the storage policies key on the first
// path segment); rows in `documents` point at them. Managers upload, edit and archive; every project member
// reads, and downloads go through short-lived signed URLs.
import { supabase, DOCUMENTS_BUCKET } from "@/lib/supabase";
import { canPreviewImage, documentStoragePath, safeFileName } from "@/features/documents/domain/documents";
import type { Database } from "@/domain/db.types";
import type { DocumentCategory, ProjectDocument } from "@/lib/database.types";

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type Result<T> = { data: T | null; error: { message: string } | null };

export type NewDocument = {
  file: File;
  category: DocumentCategory;
  title: string;
  description: string;
  roomId: string | null;
  taskId: string | null;
  /** `version_group` of the document this is a new version of (contract/estimate); null for a new document. */
  versionOf: string | null;
};

export type DocumentPatch = {
  title?: string;
  description?: string;
  room_id?: string | null;
  task_id?: string | null;
};

/** Signed URLs expire after an hour (thumbnails) or a minute (a click on "download"). */
const THUMBNAIL_TTL = 60 * 60;
const DOWNLOAD_TTL = 60;

async function must<T>(p: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

/** A row as the app sees it: the columns the UI reads, plus the (optional) thumbnail URL. */
export function toDocument(row: DocumentRow, url = ""): ProjectDocument {
  return {
    id: row.id,
    project_id: row.project_id,
    category: row.category,
    title: row.title,
    description: row.description,
    storage_path: row.storage_path,
    file_name: row.file_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    version_group: row.version_group,
    version: row.version,
    is_current: row.is_current,
    room_id: row.room_id,
    task_id: row.task_id,
    uploaded_by: row.uploaded_by,
    archived_at: row.archived_at,
    created_at: row.created_at,
    url,
  };
}

/** Signed URLs for a batch of storage paths, keyed by path. A path that can't be signed is left out. */
async function signUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const data = await must(supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrls(unique, THUMBNAIL_TTL));
  return new Map(data.filter((d) => d.signedUrl).map((d) => [d.path as string, d.signedUrl as string]));
}

/**
 * Every document of the project the caller may see: managers get archived rows too (the page filters them
 * unless asked), clients never do (RLS). Installation photos that a browser can render get a thumbnail URL.
 */
async function listDocuments(projectId: string): Promise<ProjectDocument[]> {
  const rows = (await must(
    supabase.from("documents").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
  )) as DocumentRow[];
  const previewable = rows.filter((r) => r.category === "installation_photos" && !r.archived_at && canPreviewImage(r.mime_type));
  const urls = await signUrls(previewable.map((r) => r.storage_path));
  return rows.map((r) => toDocument(r, urls.get(r.storage_path) ?? ""));
}

/**
 * Uploads the file and inserts its row. A new version passes `versionOf`; the database numbers it and makes it
 * the only current one (the old rows stay as history). If the row insert fails the uploaded object is removed
 * again (the storage policy only lets a manager delete a file no row points at).
 */
async function uploadDocument(projectId: string, input: NewDocument): Promise<void> {
  const path = documentStoragePath(projectId, input.category, crypto.randomUUID(), input.file.name);
  await must(
    supabase.storage.from(DOCUMENTS_BUCKET).upload(path, input.file, { contentType: input.file.type || undefined, upsert: false }),
  );
  const { error } = await supabase.from("documents").insert({
    project_id: projectId,
    category: input.category,
    title: input.title,
    description: input.description,
    storage_path: path,
    file_name: safeFileName(input.file.name),
    mime_type: input.file.type,
    size_bytes: input.file.size,
    room_id: input.roomId,
    task_id: input.taskId,
    ...(input.versionOf ? { version_group: input.versionOf } : {}),
  });
  if (error) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    throw new Error(error.message);
  }
}

async function updateDocument(id: string, patch: DocumentPatch): Promise<void> {
  await must(supabase.from("documents").update(patch).eq("id", id));
}

/** Archiving hides a document from the investor and from the default list; nothing is deleted. */
async function setArchived(id: string, archived: boolean): Promise<void> {
  await must(
    supabase
      .from("documents")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id),
  );
}

/** A one-minute signed URL that makes the browser download the file under its (safe) name. */
async function downloadUrl(doc: Pick<ProjectDocument, "storage_path" | "file_name">): Promise<string> {
  const data = await must(
    supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path, DOWNLOAD_TTL, { download: doc.file_name }),
  );
  return data.signedUrl;
}

/** `features/documents`' only Supabase entry point. There is deliberately no delete. */
export const documentsRepo = { listDocuments, uploadDocument, updateDocument, setArchived, downloadUrl, signUrls };

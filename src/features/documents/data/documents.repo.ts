// The only place in `features/documents` that imports supabase-js. Files live in the private
// `project-documents` bucket at `<project_id>/<category>/<uuid>.<ext>` (the storage policies key on the first
// path segment); rows in `documents` point at them. Managers upload and edit the description (deleting goes
// through the `deleteDocument` server function: row first, then the object); every project member reads, and
// downloads go through short-lived signed URLs.
import { supabase, DOCUMENTS_BUCKET } from "@/lib/supabase";
import { documentStoragePath, safeFileName, type ShelfCategory } from "@/features/documents/domain/documents";
import type { Database } from "@/domain/db.types";
import type { ProjectDocument } from "@/lib/database.types";

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type Result<T> = { data: T | null; error: { message: string } | null };

export type NewDocument = {
  file: File;
  category: ShelfCategory;
  description: string;
};

/** A click on "download" gets a one-minute signed URL. */
const DOWNLOAD_TTL = 60;

async function must<T>(p: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

/** A row as the app sees it: the columns the UI reads. */
export function toDocument(row: DocumentRow): ProjectDocument {
  return {
    id: row.id,
    project_id: row.project_id,
    category: row.category,
    description: row.description,
    storage_path: row.storage_path,
    file_name: row.file_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    uploaded_by: row.uploaded_by,
    created_at: row.created_at,
  };
}

/** Every document of the project the caller may see (managers and the project's clients see all of them). */
async function listDocuments(projectId: string): Promise<ProjectDocument[]> {
  const rows = (await must(
    supabase.from("documents").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
  )) as DocumentRow[];
  return rows.map(toDocument);
}

/**
 * Uploads the file and inserts its row; the original file name (made storage-safe) is the title. If the row insert
 * fails the uploaded object is removed again (the storage policy only lets a manager delete a file no row points at).
 */
async function uploadDocument(projectId: string, input: NewDocument): Promise<void> {
  const path = documentStoragePath(projectId, input.category, crypto.randomUUID(), input.file.name);
  await must(
    supabase.storage.from(DOCUMENTS_BUCKET).upload(path, input.file, { contentType: input.file.type || undefined, upsert: false }),
  );
  const { error } = await supabase.from("documents").insert({
    project_id: projectId,
    category: input.category,
    description: input.description,
    storage_path: path,
    file_name: safeFileName(input.file.name),
    mime_type: input.file.type,
    size_bytes: input.file.size,
  });
  if (error) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    throw new Error(error.message);
  }
}

async function updateDescription(id: string, description: string): Promise<void> {
  await must(supabase.from("documents").update({ description }).eq("id", id));
}

/** A one-minute signed URL that makes the browser download the file under its (safe) name. */
async function downloadUrl(doc: Pick<ProjectDocument, "storage_path" | "file_name">): Promise<string> {
  const data = await must(
    supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path, DOWNLOAD_TTL, { download: doc.file_name }),
  );
  return data.signedUrl;
}

export const documentsRepo = { listDocuments, uploadDocument, updateDescription, downloadUrl };

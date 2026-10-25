// Pure rules for project documents: the five categories, the "new" marker and upload hardening (mime allow-list,
// size cap, safe file names). No React, no Supabase. Mirrors supabase/migrations/20261025000300_documents_v2.sql.
import { isHeicFile } from "@/features/media/domain/upload";
import type { DocumentCategory, ProjectDocument } from "@/lib/database.types";

/**
 * The five categories, in tab order. `installation_photos` stays in the database enum but is unused: installation
 * photos are normal photos now (T62).
 */
export type ShelfCategory = Exclude<DocumentCategory, "installation_photos">;

export const DOCUMENT_CATEGORIES: readonly ShelfCategory[] = ["contract", "estimate", "invoices", "warranties", "manuals"] as const;

// ---------------------------------------------------------------------------
// "New" marker
// ---------------------------------------------------------------------------
export const NEW_DOCUMENT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A document is "new" (nowe) when it was added within the last 7 days. A future or unparsable date is not new. */
export function isNewDocument(createdAt: string | Date, now: Date = new Date()): boolean {
  const added = new Date(createdAt).getTime();
  if (Number.isNaN(added)) return false;
  const age = now.getTime() - added;
  return age >= 0 && age <= NEW_DOCUMENT_DAYS * DAY_MS;
}

// ---------------------------------------------------------------------------
// Upload hardening (the `project-documents` bucket's rules, see the storage migration)
// ---------------------------------------------------------------------------
/** 25 MB, the bucket's `file_size_limit`. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Stored mime type → the file extensions that may carry it. HEIC is not stored: it is converted to JPEG before upload. */
const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  [DOCX]: ["docx"],
  [XLSX]: ["xlsx"],
};

export const ALLOWED_DOCUMENT_MIME_TYPES: readonly string[] = Object.keys(MIME_EXTENSIONS);

/** The `accept` attribute for the file picker. */
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.docx,.xlsx";

export type DocumentFileRejection = "type" | "size" | "empty" | "extension";

/** Lowercased extension without the dot, "" when there is none. */
export function extensionOf(fileName: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Checks mime type, extension/mime agreement and size. Returns the failing rule, or null when the file is fine. */
export function validateDocumentFile(file: { name: string; type: string; size: number }): DocumentFileRejection | null {
  if (file.size <= 0) return "empty";
  if (isHeicFile(file)) return file.size > MAX_DOCUMENT_BYTES ? "size" : null; // converted to JPEG in the browser
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) return "type";
  if (!MIME_EXTENSIONS[file.type].includes(extensionOf(file.name))) return "extension";
  if (file.size > MAX_DOCUMENT_BYTES) return "size";
  return null;
}

/**
 * A storage-safe file name: no directories, no control or reserved characters, no leading dots, accents
 * folded, at most 100 characters, extension kept (lowercased). "Umowa (final)?.PDF" → "Umowa-final.pdf".
 */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const ext = extensionOf(base);
  const stem = (ext ? base.slice(0, -(ext.length + 1)) : base)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 100)
    .replace(/[.-]+$/g, "");
  const safeStem = stem || "document";
  return ext ? `${safeStem}.${ext}` : safeStem;
}

/** The storage path convention: `<project_id>/<category>/<uuid>.<ext>` (the storage policies key on the first segment). */
export function documentStoragePath(projectId: string, category: ShelfCategory, uuid: string, fileName: string): string {
  return `${projectId}/${category}/${uuid}.${extensionOf(fileName) || "bin"}`;
}

// ---------------------------------------------------------------------------
// File kind (for the icon and the "PDF / DOCX" label)
// ---------------------------------------------------------------------------
export type FileKind = "pdf" | "image" | "word" | "excel" | "file";

export function fileKind(mimeType: string): FileKind {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === DOCX) return "word";
  if (mimeType === XLSX) return "excel";
  return "file";
}

/** Short type label shown next to a document: "PDF", "JPG", "DOCX"… */
export function fileTypeLabel(mimeType: string, fileName = ""): string {
  switch (mimeType) {
    case "application/pdf":
      return "PDF";
    case "image/jpeg":
      return "JPG";
    case "image/png":
      return "PNG";
    case "image/webp":
      return "WEBP";
    case "image/heic": // legacy rows only; new uploads are converted to JPEG
      return "HEIC";
    case DOCX:
      return "DOCX";
    case XLSX:
      return "XLSX";
    default:
      return extensionOf(fileName).toUpperCase() || "FILE";
  }
}

/** "1.2 MB", "340 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Listing helpers
// ---------------------------------------------------------------------------
const byNewest = (a: ProjectDocument, b: ProjectDocument) => b.created_at.localeCompare(a.created_at);

/** Documents of one category, newest first. */
export function documentsOf(docs: ProjectDocument[], category: ShelfCategory): ProjectDocument[] {
  return docs.filter((d) => d.category === category).sort(byNewest);
}

export function countByCategory(docs: ProjectDocument[]): Record<ShelfCategory, number> {
  const counts = Object.fromEntries(DOCUMENT_CATEGORIES.map((c) => [c, 0])) as Record<ShelfCategory, number>;
  for (const d of docs) if (d.category in counts) counts[d.category as ShelfCategory] += 1;
  return counts;
}

// Pure upload rules: allowed mime types and size limits per upload kind (matching the storage
// buckets' `allowed_mime_types`/`file_size_limit`, supabase/migrations/20260924000400_storage.sql),
// the re-encode dimension cap, and which files get re-encoded. No React, no Supabase, no canvas —
// easy to unit test (tests/unit/media/strip-exif.test.ts).

export type MediaKind = "photo" | "render";

/** Both storage buckets cap uploads at 15 MB. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Longest edge, in pixels, that a re-encoded image is capped at. */
export const MAX_DIMENSION = 2560;

/** Quality used when re-encoding to JPEG. */
export const JPEG_QUALITY = 0.9;

const STANDARD_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const HEIC_TYPES = ["image/heic", "image/heif"] as const;

/**
 * Mime types the storage buckets accept (the `project-media` bucket also allows `application/pdf`). HEIC is not
 * among them: it is converted to JPEG in the browser before upload (see ./normalize-image), so `validateFile` lets
 * a HEIC pick through.
 */
export function allowedMimeTypes(_kind: MediaKind): readonly string[] {
  return STANDARD_IMAGE_TYPES;
}

export type FileRejection = "type" | "size";

/** Checks a file against the kind's mime/size rules. Returns the failing rule, or null when it's fine. */
export function validateFile(file: { name?: string; type: string; size: number }, kind: MediaKind): FileRejection | null {
  if (!isHeicFile(file) && !allowedMimeTypes(kind).includes(file.type)) return "type";
  if (file.size > MAX_UPLOAD_BYTES) return "size";
  return null;
}

export function isHeic(mimeType: string): boolean {
  return (HEIC_TYPES as readonly string[]).includes(mimeType);
}

/** HEIC/HEIF by mime type or by file extension (Chrome often reports an empty `type` for `.heic`). */
export function isHeicFile(file: { name?: string; type: string }): boolean {
  return isHeic(file.type.toLowerCase()) || /\.(heic|heif)$/i.test(file.name ?? "");
}

/** Whether `normalizeImage` should process this file: a standard raster image or a HEIC/HEIF photo. */
export function shouldNormalize(file: { name?: string; type: string }): boolean {
  return isHeicFile(file) || shouldReencode(file.type);
}

/**
 * Whether a file should be re-encoded (EXIF/GPS stripped, dimensions capped) before upload: a
 * standard raster image the browser can decode via `createImageBitmap`. HEIC is
 * converted to JPEG first (see `shouldNormalize` and ./normalize-image).
 */
export function shouldReencode(mimeType: string): boolean {
  return (STANDARD_IMAGE_TYPES as readonly string[]).includes(mimeType);
}

/** Every re-encoded image becomes a JPEG at `JPEG_QUALITY` — smallest and most broadly supported. */
export function reencodeOutputType(): "image/jpeg" {
  return "image/jpeg";
}

/** The output size for an image capped at `max` on its longest edge, preserving aspect ratio and never upscaling. */
export function capDimensions(width: number, height: number, max: number = MAX_DIMENSION): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max || longest <= 0) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

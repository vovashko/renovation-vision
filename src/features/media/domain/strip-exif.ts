// Capture-date extraction (exifr, works on a plain ArrayBuffer/Blob — testable in Node/jsdom) and
// the canvas re-encode pipeline that strips EXIF/GPS and caps dimensions.
//
// `reencodeImage` is browser-only: `createImageBitmap` and a working 2D canvas aren't implemented in
// jsdom (no `canvas` npm package here), so it can't run under vitest. tests/unit/media/strip-exif.test.ts
// covers `extractTakenAt` (against tests/fixtures/gps.jpg, a real JPEG with GPS EXIF) and the pure
// rules in ./upload; the re-encode path needs a real browser and was checked manually (see the PR).
import { parse as parseExif } from "exifr";
import { JPEG_QUALITY, capDimensions, reencodeOutputType } from "./upload";

/** The photo's capture date (EXIF `DateTimeOriginal`), as an ISO string, or null when the file has none. */
export async function extractTakenAt(file: Blob): Promise<string | null> {
  try {
    const exif = (await parseExif(file, { pick: ["DateTimeOriginal"] })) as { DateTimeOriginal?: unknown } | undefined;
    const date = exif?.DateTimeOriginal;
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  } catch {
    return null; // no EXIF segment (PNG/WebP), or a parse error — the caller falls back to "now"
  }
}

export type ReencodeResult = { file: File; takenAt: string | null };

type MinimalCanvas = { getContext(id: "2d"): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null };

async function canvasToJpegBlob(canvas: MinimalCanvas & (OffscreenCanvas | HTMLCanvasElement)): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: reencodeOutputType(), quality: JPEG_QUALITY });
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob failed"))), reencodeOutputType(), JPEG_QUALITY),
  );
}

/**
 * Re-encodes `file` through a canvas: decoding and redrawing the pixels drops every metadata
 * segment (EXIF/GPS included), the longest edge is capped at `MAX_DIMENSION`, and the result is
 * exported as JPEG. The capture date is read first, since re-encoding destroys it.
 */
export async function reencodeImage(file: File): Promise<ReencodeResult> {
  const takenAt = await extractTakenAt(file);
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = capDimensions(bitmap.width, bitmap.height);
    const canvas: OffscreenCanvas | HTMLCanvasElement =
      typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : document.createElement("canvas");
    if (!(canvas instanceof OffscreenCanvas)) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvasToJpegBlob(canvas);
    const name = file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
    return { file: new File([blob], name, { type: reencodeOutputType() }), takenAt };
  } finally {
    bitmap.close();
  }
}

// Turns any picked image into a stripped, capped JPEG: HEIC/HEIF is converted first (natively where the
// browser can decode it, otherwise with the lazily loaded `heic-to` WASM decoder), then every image goes
// through `reencodeImage` (canvas re-encode: EXIF/GPS dropped, longest edge capped). The capture date is
// read from the original file first, since each conversion destroys it. Browser-only, like reencodeImage;
// tests/unit/media/normalize-image.test.ts mocks the decoders.
import { TranslatedError } from "@/shared/i18n-error";
import { extractTakenAt, reencodeImage, type ReencodeResult } from "./strip-exif";
import { JPEG_QUALITY, MAX_DIMENSION, isHeicFile, reencodeOutputType } from "./upload";

/** Thrown when a HEIC/HEIF photo can't be decoded; the UI shows a translated message. */
export class HeicConversionError extends TranslatedError {
  constructor(options?: { cause?: unknown }) {
    super("media:upload.heicConversionFailed", "Couldn't convert this HEIC photo. Send it as a JPG instead.", options);
    this.name = "HeicConversionError";
  }
}

/** True when the browser itself can decode the file (Safari 17+ decodes HEIC through createImageBitmap). */
async function canDecodeNatively(file: File): Promise<boolean> {
  if (typeof createImageBitmap !== "function") return false;
  try {
    const bitmap = await createImageBitmap(file);
    bitmap.close();
    return true;
  } catch {
    return false;
  }
}

/** Converts a HEIC/HEIF file to a JPEG file named `<name>.jpg`. Own chunk: `heic-to` is only fetched here. */
async function heicToJpeg(file: File): Promise<File> {
  try {
    const { heicTo } = await import("heic-to/csp");
    const blob = await heicTo({ blob: file, type: reencodeOutputType(), quality: JPEG_QUALITY });
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg", { type: reencodeOutputType() });
  } catch (cause) {
    throw new HeicConversionError({ cause });
  }
}

/**
 * Prepares an image for upload: HEIC/HEIF (detected by mime or extension — Chrome often reports an empty
 * type for `.heic`) is decoded natively or via `heic-to`, then `reencodeImage` produces the final JPEG.
 * Other images go straight to `reencodeImage`.
 */
export async function normalizeImage(file: File, maxDimension: number = MAX_DIMENSION): Promise<ReencodeResult> {
  if (!isHeicFile(file)) return reencodeImage(file, maxDimension);
  const takenAt = await extractTakenAt(file); // exifr reads HEIC's EXIF box
  const decodable = (await canDecodeNatively(file)) ? file : await heicToJpeg(file);
  const result = await reencodeImage(decodable, maxDimension);
  return { file: result.file, takenAt: takenAt ?? result.takenAt };
}

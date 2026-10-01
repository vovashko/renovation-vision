// Pure rules (mime/size/dimension math) and the EXIF capture-date extractor, both of which run fine
// under jsdom/Node. The canvas re-encode path (`reencodeImage`) needs `createImageBitmap` and a real
// 2D canvas, neither implemented in jsdom here (no `canvas` npm polyfill) — it was checked manually
// against this same fixture in a real browser (see the PR's Verification section), not in this suite.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseExif } from "exifr";
import { describe, expect, it } from "vitest";
import {
  allowedMimeTypes,
  capDimensions,
  isHeic,
  MAX_DIMENSION,
  MAX_UPLOAD_BYTES,
  reencodeOutputType,
  shouldReencode,
  validateFile,
} from "@/features/media/domain/upload";
import { extractTakenAt } from "@/features/media/domain/strip-exif";

const FIXTURE_PATH = path.join(process.cwd(), "tests/fixtures/gps.jpg");

describe("allowedMimeTypes / validateFile", () => {
  it("accepts jpeg/png/webp/heic for photos, rejects everything else", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) {
      expect(validateFile({ type, size: 1024 }, "photo")).toBeNull();
    }
    expect(validateFile({ type: "application/pdf", size: 1024 }, "photo")).toBe("type");
    expect(validateFile({ type: "image/gif", size: 1024 }, "photo")).toBe("type");
  });

  it("rejects HEIC for renders (jpeg/png/webp only)", () => {
    expect(allowedMimeTypes("render")).not.toContain("image/heic");
    expect(validateFile({ type: "image/heic", size: 1024 }, "render")).toBe("type");
    expect(validateFile({ type: "image/jpeg", size: 1024 }, "render")).toBeNull();
  });

  it("rejects a file over the 15 MB bucket limit", () => {
    expect(validateFile({ type: "image/jpeg", size: MAX_UPLOAD_BYTES }, "photo")).toBeNull();
    expect(validateFile({ type: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 }, "photo")).toBe("size");
  });

  it("type is checked before size (one rejection reason)", () => {
    expect(validateFile({ type: "application/pdf", size: MAX_UPLOAD_BYTES + 1 }, "photo")).toBe("type");
  });
});

describe("isHeic / shouldReencode / reencodeOutputType", () => {
  it("flags HEIC/HEIF and only those as not re-encodable", () => {
    expect(isHeic("image/heic")).toBe(true);
    expect(isHeic("image/heif")).toBe(true);
    expect(isHeic("image/jpeg")).toBe(false);
    expect(shouldReencode("image/jpeg")).toBe(true);
    expect(shouldReencode("image/png")).toBe(true);
    expect(shouldReencode("image/webp")).toBe(true);
    expect(shouldReencode("image/heic")).toBe(false);
  });

  it("always re-encodes to JPEG", () => {
    expect(reencodeOutputType()).toBe("image/jpeg");
  });
});

describe("capDimensions", () => {
  it("leaves an image at or under the cap untouched", () => {
    expect(capDimensions(1200, 800)).toEqual({ width: 1200, height: 800 });
    expect(capDimensions(MAX_DIMENSION, MAX_DIMENSION)).toEqual({ width: MAX_DIMENSION, height: MAX_DIMENSION });
  });

  it("caps the longest edge and preserves aspect ratio for a landscape image", () => {
    expect(capDimensions(5120, 2560)).toEqual({ width: MAX_DIMENSION, height: 1280 });
  });

  it("caps the longest edge and preserves aspect ratio for a portrait image", () => {
    expect(capDimensions(2560, 5120)).toEqual({ width: 1280, height: MAX_DIMENSION });
  });

  it("never upscales a smaller image, and never produces a zero dimension", () => {
    expect(capDimensions(100, 50)).toEqual({ width: 100, height: 50 });
    expect(capDimensions(10000, 1)).toEqual({ width: MAX_DIMENSION, height: 1 });
  });

  it("respects a custom cap", () => {
    expect(capDimensions(2000, 1000, 500)).toEqual({ width: 500, height: 250 });
  });
});

describe("extractTakenAt", () => {
  it("reads DateTimeOriginal from a real JPEG's EXIF", async () => {
    const buf = await readFile(FIXTURE_PATH);
    const file = new File([buf], "gps.jpg", { type: "image/jpeg" });
    expect(await extractTakenAt(file)).toBe(new Date("2024-05-17T10:30:00").toISOString());
  });

  it("the same fixture also carries GPS — reencodeImage strips it (verified manually, see the PR)", async () => {
    const buf = await readFile(FIXTURE_PATH);
    const file = new File([buf], "gps.jpg", { type: "image/jpeg" });
    const gps = (await parseExif(file, { pick: ["GPSLatitude", "GPSLongitude"] })) as { GPSLatitude?: unknown } | undefined;
    expect(gps?.GPSLatitude).toBeDefined();
  });

  it("returns null for a file with no EXIF segment", async () => {
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG signature only
    const file = new File([pngBytes], "plain.png", { type: "image/png" });
    expect(await extractTakenAt(file)).toBeNull();
  });
});

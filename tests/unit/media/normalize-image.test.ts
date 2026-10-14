// normalizeImage's routing, with the decoders mocked: jsdom has no createImageBitmap, no canvas and cannot
// run the libheif WASM. What this proves: HEIC is detected by mime or by extension, the native decode is
// preferred over the heic-to fallback, the final file always comes out of reencodeImage (the canvas step that
// drops EXIF/GPS) as image/jpeg, the capture date is read from the original, and a failed decode surfaces
// as a translated error. The real decode (a .heic picked in Chrome and Safari, the stored object having no
// GPS) is a manual check, listed in the PR.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { heicTo, extractTakenAt, reencodeImage } = vi.hoisted(() => ({ heicTo: vi.fn(), extractTakenAt: vi.fn(), reencodeImage: vi.fn() }));

vi.mock("heic-to/csp", () => ({ heicTo }));
vi.mock("@/features/media/domain/strip-exif", () => ({ extractTakenAt, reencodeImage }));

import { HeicConversionError, normalizeImage } from "@/features/media/domain/normalize-image";
import { translatedErrorKey } from "@/shared/i18n-error";

const heicFile = (name = "IMG_0001.HEIC", type = "") => new File([new Uint8Array([1, 2, 3])], name, { type });
const jpegOut = () => new File([new Uint8Array([9])], "out.jpg", { type: "image/jpeg" });

beforeEach(() => {
  extractTakenAt.mockResolvedValue("2026-05-01T10:00:00.000Z");
  reencodeImage.mockImplementation(async () => ({ file: jpegOut(), takenAt: null }));
  heicTo.mockResolvedValue(new Blob([new Uint8Array([7])], { type: "image/jpeg" }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("normalizeImage", () => {
  it("passes a non-HEIC image straight to reencodeImage", async () => {
    const png = new File([new Uint8Array([1])], "a.png", { type: "image/png" });
    reencodeImage.mockResolvedValueOnce({ file: jpegOut(), takenAt: "2026-01-01T00:00:00.000Z" });
    const result = await normalizeImage(png);
    expect(reencodeImage).toHaveBeenCalledWith(png, expect.anything());
    expect(heicTo).not.toHaveBeenCalled();
    expect(result.takenAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.file.type).toBe("image/jpeg");
  });

  it("detects HEIC by extension when the browser reports an empty mime type, and falls back to heic-to", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("unsupported")));
    const input = heicFile("IMG_0001.HEIC", "");
    const result = await normalizeImage(input);

    expect(heicTo).toHaveBeenCalledWith({ blob: input, type: "image/jpeg", quality: expect.any(Number) });
    const decoded = reencodeImage.mock.calls[0][0] as File;
    expect(decoded.type).toBe("image/jpeg");
    expect(decoded.name).toBe("IMG_0001.jpg");
    expect(result.file.type).toBe("image/jpeg");
    expect(result.file.name).toMatch(/\.jpg$/);
  });

  it("uses the native decoder when createImageBitmap can read the HEIC (no heic-to download)", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ close }));
    const input = heicFile("a.heic", "image/heic");
    await normalizeImage(input);

    expect(heicTo).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(reencodeImage.mock.calls[0][0]).toBe(input); // the original goes to the canvas step
  });

  it("reads the capture date from the original HEIC, since the re-encoded JPEG has none", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("unsupported")));
    const input = heicFile();
    const result = await normalizeImage(input);
    expect(extractTakenAt).toHaveBeenCalledWith(input);
    expect(result.takenAt).toBe("2026-05-01T10:00:00.000Z");
  });

  it("returns the reencodeImage output (canvas redraw drops EXIF/GPS), always image/jpeg", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("unsupported")));
    const out = jpegOut();
    reencodeImage.mockResolvedValueOnce({ file: out, takenAt: null });
    const result = await normalizeImage(heicFile("x.heif", "image/heif"));
    expect(result.file).toBe(out);
    expect(result.file.type).toBe("image/jpeg");
  });

  it("surfaces a failed conversion as a translated HeicConversionError", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("unsupported")));
    heicTo.mockRejectedValue(new Error("ERR_LIBHEIF format not supported"));
    const error = await normalizeImage(heicFile()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HeicConversionError);
    expect(translatedErrorKey(error)).toBe("media:upload.heicConversionFailed");
    expect((error as Error).message).toBe("Couldn't convert this HEIC photo. Send it as a JPG instead.");
    expect(reencodeImage).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const { createSignedUrls, storageFrom } = vi.hoisted(() => {
  const createSignedUrls = vi.fn();
  const storageFrom = vi.fn(() => ({ createSignedUrls }));
  return { createSignedUrls, storageFrom };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { storage: { from: storageFrom } },
  MEDIA_BUCKET: "project-media",
  INTERNAL_BUCKET: "project-internal",
}));

import { mediaPath, signUrls } from "@/features/media/data/media.repo";

function file(name: string) {
  return new File(["x"], name, { type: "image/jpeg" });
}

describe("mediaPath", () => {
  beforeEach(() => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-1111-1111-111111111111");
  });

  it("builds <project>/<folder>/<uuid>.<ext>, reading the extension from the file name", () => {
    expect(mediaPath("proj-1", "photos", file("kitchen.PNG"))).toBe("proj-1/photos/11111111-1111-1111-1111-111111111111.png");
  });

  it("uses the renders folder for render uploads", () => {
    expect(mediaPath("proj-1", "renders", file("living-room.jpg"))).toBe("proj-1/renders/11111111-1111-1111-1111-111111111111.jpg");
  });

  it("falls back to jpg when the file has no extension", () => {
    expect(mediaPath("proj-1", "photos", file("IMG"))).toBe("proj-1/photos/11111111-1111-1111-1111-111111111111.jpg");
  });
});

describe("signUrls", () => {
  beforeEach(() => {
    createSignedUrls.mockReset();
    storageFrom.mockClear();
  });

  it("maps each storage path to its signed URL", async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: "proj-1/photos/a.jpg", signedUrl: "https://signed/a.jpg" },
        { path: "proj-1/photos/b.jpg", signedUrl: "https://signed/b.jpg" },
      ],
      error: null,
    });

    const result = await signUrls("project-media", ["proj-1/photos/a.jpg", "proj-1/photos/b.jpg"]);

    expect(storageFrom).toHaveBeenCalledWith("project-media");
    expect(result.get("proj-1/photos/a.jpg")).toBe("https://signed/a.jpg");
    expect(result.get("proj-1/photos/b.jpg")).toBe("https://signed/b.jpg");
  });

  it("leaves out a path whose signed URL is missing", async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: "proj-1/photos/a.jpg", signedUrl: "https://signed/a.jpg" },
        { path: "proj-1/photos/missing.jpg", signedUrl: null },
      ],
      error: null,
    });

    const result = await signUrls("project-media", ["proj-1/photos/a.jpg", "proj-1/photos/missing.jpg"]);

    expect(result.get("proj-1/photos/a.jpg")).toBe("https://signed/a.jpg");
    expect(result.get("proj-1/photos/missing.jpg")).toBeUndefined();
    expect(result.has("proj-1/photos/missing.jpg")).toBe(false);
  });

  it("returns an empty map without calling storage for an empty path list", async () => {
    const result = await signUrls("project-media", []);
    expect(result.size).toBe(0);
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it("de-duplicates and drops empty paths before signing", async () => {
    createSignedUrls.mockResolvedValue({ data: [{ path: "proj-1/photos/a.jpg", signedUrl: "https://signed/a.jpg" }], error: null });

    await signUrls("project-media", ["proj-1/photos/a.jpg", "proj-1/photos/a.jpg", ""]);

    expect(createSignedUrls).toHaveBeenCalledWith(["proj-1/photos/a.jpg"], 60 * 60);
  });
});

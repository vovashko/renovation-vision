import { describe, it, expect } from "vitest";
import { photoEditSchema, renderSchema, uploadPhotosSchema } from "@/features/media/domain/schemas";

function file(name = "photo.jpg") {
  return new File(["x"], name, { type: "image/jpeg" });
}

describe("uploadPhotosSchema", () => {
  it("accepts one or more files with the other fields optional/blank", () => {
    const result = uploadPhotosSchema.safeParse({ files: [file()], stageId: "", roomId: "", caption: "", publish: false });
    expect(result.success).toBe(true);
  });

  it("rejects an empty file list with an i18n key message", () => {
    const result = uploadPhotosSchema.safeParse({ files: [], stageId: "", roomId: "", caption: "", publish: false });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("media:upload.filesRequired");
  });
});

describe("photoEditSchema", () => {
  it("accepts blank caption/alt/stage/room", () => {
    expect(photoEditSchema.safeParse({ caption: "", alt: "", stageId: "", roomId: "" }).success).toBe(true);
  });

  it("accepts a filled-in edit", () => {
    const result = photoEditSchema.safeParse({ caption: "New tiles", alt: "The new kitchen tiles", stageId: "s1", roomId: "r1" });
    expect(result.success).toBe(true);
  });
});

describe("renderSchema", () => {
  const base = { description: "", alt: "", roomId: "", comparePhotoId: "", isVisible: false };

  it("requires a title", () => {
    const result = renderSchema(false).safeParse({ ...base, title: "", file: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.message === "common:form.required")).toBe(true);
  });

  it("requires a file for a new render", () => {
    const result = renderSchema(true).safeParse({ ...base, title: "Kitchen", file: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("media:render.fileRequired");
  });

  it("accepts a new render with a file", () => {
    const result = renderSchema(true).safeParse({ ...base, title: "Kitchen", file: file() });
    expect(result.success).toBe(true);
  });

  it("accepts editing a render without replacing its file", () => {
    const result = renderSchema(false).safeParse({ ...base, title: "Kitchen", file: null });
    expect(result.success).toBe(true);
  });
});

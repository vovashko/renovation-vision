import { describe, it, expect } from "vitest";
import { photoEditSchema, renderSchema, resolveTaskId, uploadPhotosSchema } from "@/features/media/domain/schemas";

function file(name = "photo.jpg") {
  return new File(["x"], name, { type: "image/jpeg" });
}

describe("uploadPhotosSchema", () => {
  it("accepts one or more files with the other fields optional/blank", () => {
    const result = uploadPhotosSchema.safeParse({ files: [file()], stageId: "", taskId: "", roomId: "", caption: "", publish: false });
    expect(result.success).toBe(true);
  });

  it("rejects an empty file list with an i18n key message", () => {
    const result = uploadPhotosSchema.safeParse({ files: [], stageId: "", taskId: "", roomId: "", caption: "", publish: false });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("media:upload.filesRequired");
  });
});

describe("photoEditSchema", () => {
  it("accepts blank caption/alt/stage/room", () => {
    expect(photoEditSchema.safeParse({ caption: "", alt: "", stageId: "", taskId: "", roomId: "" }).success).toBe(true);
  });

  it("accepts a filled-in edit", () => {
    const result = photoEditSchema.safeParse({
      caption: "New tiles",
      alt: "The new kitchen tiles",
      stageId: "s1",
      taskId: "",
      roomId: "r1",
    });
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

describe("resolveTaskId", () => {
  const stages = [
    { id: "wall", tasks: [{ id: "t1" }, { id: "t2" }] },
    { id: "floor", tasks: [{ id: "t3" }] },
  ];

  it("keeps a task that belongs to the chosen step", () => {
    expect(resolveTaskId(stages, "wall", "t2")).toBe("t2");
  });

  it("drops a task from another step, so changing the step never leaves a stale task", () => {
    expect(resolveTaskId(stages, "floor", "t2")).toBeNull();
  });

  it("is null for the whole step, an unknown step, or no step at all", () => {
    expect(resolveTaskId(stages, "wall", "")).toBeNull();
    expect(resolveTaskId(stages, "nope", "t1")).toBeNull();
    expect(resolveTaskId(stages, "", "t1")).toBeNull();
  });
});

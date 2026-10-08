import { describe, expect, it } from "vitest";
import { editDocumentSchema, uploadDocumentSchema } from "@/features/documents/domain/schemas";

const pdf = new File(["x"], "umowa.pdf", { type: "application/pdf" });
const jpg = new File(["x"], "wiring.jpg", { type: "image/jpeg" });

const base = { title: "Umowa", category: "contract", description: "", file: pdf, roomId: "", taskId: "", versionOf: "" };
const messages = (values: unknown) => {
  const r = uploadDocumentSchema.safeParse(values);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("uploadDocumentSchema", () => {
  it("accepts a contract with a pdf", () => {
    expect(uploadDocumentSchema.safeParse(base).success).toBe(true);
  });

  it("requires a title and a file", () => {
    expect(messages({ ...base, title: "   " })).toContain("common:form.required");
    expect(messages({ ...base, file: null })).toContain("documents:upload.fileRequired");
  });

  it("rejects a disallowed type, a mismatched extension, an empty file and an oversized one", () => {
    expect(messages({ ...base, file: new File(["x"], "a.exe", { type: "application/x-msdownload" }) })).toContain(
      "documents:upload.fileTypeNotAllowed",
    );
    expect(messages({ ...base, file: new File(["x"], "a.html", { type: "application/pdf" }) })).toContain(
      "documents:upload.fileExtensionMismatch",
    );
    expect(messages({ ...base, file: new File([], "a.pdf", { type: "application/pdf" }) })).toContain("documents:upload.fileEmpty");
    const big = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });
    expect(messages({ ...base, file: big })).toContain("documents:upload.fileTooLarge");
  });

  it("rejects an unknown category", () => {
    expect(uploadDocumentSchema.safeParse({ ...base, category: "payments" }).success).toBe(false);
  });

  it("installation photos need a room and an image; the work stays optional", () => {
    const photo = { ...base, category: "installation_photos", file: jpg };
    expect(messages(photo)).toContain("documents:upload.roomRequired");
    expect(uploadDocumentSchema.safeParse({ ...photo, roomId: "r1" }).success).toBe(true);
    expect(uploadDocumentSchema.safeParse({ ...photo, roomId: "r1", taskId: "t1" }).success).toBe(true);
    expect(messages({ ...photo, roomId: "r1", file: pdf })).toContain("documents:upload.photoMustBeImage");
  });

  it("other categories don't need a room", () => {
    expect(uploadDocumentSchema.safeParse({ ...base, category: "invoices" }).success).toBe(true);
    expect(uploadDocumentSchema.safeParse({ ...base, category: "manuals", description: "Model X, 2 years" }).success).toBe(true);
  });

  it("caps title and description lengths", () => {
    expect(messages({ ...base, title: "a".repeat(201) })).toContain("documents:upload.titleTooLong");
    expect(messages({ ...base, description: "a".repeat(2001) })).toContain("documents:upload.descriptionTooLong");
  });
});

describe("editDocumentSchema", () => {
  it("requires a title, and a room for installation photos only", () => {
    expect(editDocumentSchema(false).safeParse({ title: "x", description: "", roomId: "", taskId: "" }).success).toBe(true);
    expect(editDocumentSchema(false).safeParse({ title: " ", description: "", roomId: "", taskId: "" }).success).toBe(false);
    expect(editDocumentSchema(true).safeParse({ title: "x", description: "", roomId: "", taskId: "" }).success).toBe(false);
    expect(editDocumentSchema(true).safeParse({ title: "x", description: "", roomId: "r1", taskId: "" }).success).toBe(true);
  });
});

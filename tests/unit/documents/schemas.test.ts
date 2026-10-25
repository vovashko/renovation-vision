import { describe, expect, it } from "vitest";
import { editDocumentSchema, uploadDocumentSchema } from "@/features/documents/domain/schemas";

const pdf = new File(["x"], "umowa.pdf", { type: "application/pdf" });

const base = { category: "contract", description: "", file: pdf };
const messages = (values: unknown) => {
  const r = uploadDocumentSchema.safeParse(values);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("uploadDocumentSchema", () => {
  it("accepts a contract with a pdf", () => {
    expect(uploadDocumentSchema.safeParse(base).success).toBe(true);
  });

  it("requires a file (its name is the title, so there is no title field)", () => {
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

  it("every category is accepted", () => {
    expect(uploadDocumentSchema.safeParse({ ...base, category: "invoices" }).success).toBe(true);
    expect(uploadDocumentSchema.safeParse({ ...base, category: "manuals", description: "Model X, 2 years" }).success).toBe(true);
  });

  it("rejects the unused installation_photos category", () => {
    expect(uploadDocumentSchema.safeParse({ ...base, category: "installation_photos" }).success).toBe(false);
  });

  it("caps the description length", () => {
    expect(messages({ ...base, description: "a".repeat(2001) })).toContain("documents:upload.descriptionTooLong");
  });
});

describe("editDocumentSchema", () => {
  it("only the description can change, up to 2000 characters", () => {
    expect(editDocumentSchema.safeParse({ description: "" }).success).toBe(true);
    expect(editDocumentSchema.safeParse({ description: "a".repeat(2001) }).success).toBe(false);
  });
});

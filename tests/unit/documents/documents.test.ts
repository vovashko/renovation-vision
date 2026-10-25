import { describe, expect, it } from "vitest";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  DOCUMENT_CATEGORIES,
  MAX_DOCUMENT_BYTES,
  countByCategory,
  documentStoragePath,
  documentsOf,
  fileKind,
  fileTypeLabel,
  formatFileSize,
  isNewDocument,
  safeFileName,
  validateDocumentFile,
} from "@/features/documents/domain/documents";
import type { ProjectDocument } from "@/lib/database.types";

const NOW = new Date("2026-10-08T12:00:00Z");
const daysAgo = (d: number, extraMs = 0) => new Date(NOW.getTime() - d * 86_400_000 - extraMs).toISOString();

function doc(patch: Partial<ProjectDocument> = {}): ProjectDocument {
  return {
    id: "d1",
    project_id: "p1",
    category: "invoices",
    description: "",
    storage_path: "p1/invoices/d1.pdf",
    file_name: "doc.pdf",
    mime_type: "application/pdf",
    size_bytes: 1000,
    uploaded_by: null,
    created_at: daysAgo(1),
    ...patch,
  };
}

describe("categories", () => {
  it("are exactly the five, in tab order (installation photos are normal photos now)", () => {
    expect([...DOCUMENT_CATEGORIES]).toEqual(["contract", "estimate", "invoices", "warranties", "manuals"]);
  });
});

describe("isNewDocument", () => {
  it("is new when added today or within the last 7 days", () => {
    expect(isNewDocument(NOW.toISOString(), NOW)).toBe(true);
    expect(isNewDocument(daysAgo(3), NOW)).toBe(true);
    expect(isNewDocument(daysAgo(7), NOW)).toBe(true);
  });

  it("is not new after 7 days", () => {
    expect(isNewDocument(daysAgo(7, 1), NOW)).toBe(false);
    expect(isNewDocument(daysAgo(30), NOW)).toBe(false);
  });

  it("is not new for a future or unparsable date", () => {
    expect(isNewDocument(daysAgo(-1), NOW)).toBe(false);
    expect(isNewDocument("not a date", NOW)).toBe(false);
  });

  it("accepts a Date and defaults `now` to the current time", () => {
    expect(isNewDocument(new Date(NOW.getTime() - 1000), NOW)).toBe(true);
    expect(isNewDocument(new Date().toISOString())).toBe(true);
    expect(isNewDocument(new Date(Date.now() - 8 * 86_400_000).toISOString())).toBe(false);
  });
});

describe("validateDocumentFile", () => {
  const file = (name: string, type: string, size = 1000) => ({ name, type, size });

  it("accepts every allowed type with a matching extension", () => {
    const ok = [
      file("a.pdf", "application/pdf"),
      file("a.jpg", "image/jpeg"),
      file("a.JPEG", "image/jpeg"),
      file("a.png", "image/png"),
      file("a.webp", "image/webp"),
      file("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      file("a.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ];
    for (const f of ok) expect(validateDocumentFile(f), f.name).toBeNull();
    expect(ALLOWED_DOCUMENT_MIME_TYPES).toHaveLength(6);
  });

  it("lets a HEIC pick through by mime or by extension (it is converted to JPEG before upload)", () => {
    expect(validateDocumentFile(file("a.heic", "image/heic"))).toBeNull();
    expect(validateDocumentFile(file("IMG_1.HEIC", ""))).toBeNull();
    expect(validateDocumentFile(file("a.heif", "image/heif", MAX_DOCUMENT_BYTES + 1))).toBe("size");
  });

  it("rejects other types, scripts and mismatched extensions", () => {
    expect(validateDocumentFile(file("a.exe", "application/x-msdownload"))).toBe("type");
    expect(validateDocumentFile(file("a.svg", "image/svg+xml"))).toBe("type");
    expect(validateDocumentFile(file("a.html", "text/html"))).toBe("type");
    expect(validateDocumentFile(file("a.html", "application/pdf"))).toBe("extension");
    expect(validateDocumentFile(file("noext", "application/pdf"))).toBe("extension");
  });

  it("enforces the 25 MB cap and rejects empty files", () => {
    expect(validateDocumentFile(file("a.pdf", "application/pdf", MAX_DOCUMENT_BYTES))).toBeNull();
    expect(validateDocumentFile(file("a.pdf", "application/pdf", MAX_DOCUMENT_BYTES + 1))).toBe("size");
    expect(validateDocumentFile(file("a.pdf", "application/pdf", 0))).toBe("empty");
  });
});

describe("safeFileName", () => {
  it("keeps a clean name and lowercases the extension", () => {
    expect(safeFileName("Umowa.PDF")).toBe("Umowa.pdf");
    expect(safeFileName("plan-v2_final.docx")).toBe("plan-v2_final.docx");
  });

  it("drops directories, traversal and control characters", () => {
    expect(safeFileName("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(safeFileName("C:\\Users\\me\\scan.pdf")).toBe("scan.pdf");
    expect(safeFileName("a\u0000b\u001f.pdf")).toBe("ab.pdf");
  });

  it("folds Polish letters and replaces unsafe characters", () => {
    expect(safeFileName("Faktura łazienka (końcowa)?.pdf")).toBe("Faktura-lazienka-koncowa.pdf");
    expect(safeFileName("a<b>:c|d.png")).toBe("a-b-c-d.png");
  });

  it("never returns an empty or dot-leading stem and caps the length", () => {
    expect(safeFileName("...pdf")).toBe("document.pdf");
    expect(safeFileName(".hidden.pdf")).toBe("hidden.pdf");
    expect(safeFileName("???.pdf")).toBe("document.pdf");
    expect(safeFileName("")).toBe("document");
    const long = safeFileName(`${"a".repeat(300)}.pdf`);
    expect(long.length).toBeLessThanOrEqual(104);
    expect(long.endsWith(".pdf")).toBe(true);
  });
});

describe("documentStoragePath", () => {
  it("builds <project>/<category>/<uuid>.<ext>", () => {
    expect(documentStoragePath("p1", "contract", "u-1", "Umowa.PDF")).toBe("p1/contract/u-1.pdf");
    expect(documentStoragePath("p1", "manuals", "u-2", "x.jpeg")).toBe("p1/manuals/u-2.jpeg");
  });
});

describe("file kind", () => {
  it("maps mime types to icon kinds and labels", () => {
    expect(fileKind("application/pdf")).toBe("pdf");
    expect(fileKind("image/png")).toBe("image");
    expect(fileKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("word");
    expect(fileKind("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("excel");
    expect(fileKind("text/plain")).toBe("file");
    expect(fileTypeLabel("application/pdf")).toBe("PDF");
    expect(fileTypeLabel("image/jpeg")).toBe("JPG");
    expect(fileTypeLabel("application/octet-stream", "x.dwg")).toBe("DWG");
  });

  it("formats sizes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(340 * 1024)).toBe("340 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});

describe("listing helpers", () => {
  const docs = [
    doc({ id: "a", category: "invoices", created_at: daysAgo(5) }),
    doc({ id: "b", category: "invoices", created_at: daysAgo(1) }),
    doc({ id: "d", category: "manuals" }),
  ];

  it("lists a category newest first", () => {
    expect(documentsOf(docs, "invoices").map((d) => d.id)).toEqual(["b", "a"]);
  });

  it("counts per category", () => {
    expect(countByCategory(docs)).toMatchObject({ invoices: 2, manuals: 1, contract: 0 });
  });
});

import { describe, expect, it } from "vitest";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  DOCUMENT_CATEGORIES,
  MAX_DOCUMENT_BYTES,
  canPreviewImage,
  countByCategory,
  documentStoragePath,
  documentsOf,
  fileKind,
  fileTypeLabel,
  formatFileSize,
  groupByRoom,
  groupVersions,
  isNewDocument,
  isVersionedCategory,
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
    title: "Doc",
    description: "",
    storage_path: "p1/invoices/d1.pdf",
    file_name: "doc.pdf",
    mime_type: "application/pdf",
    size_bytes: 1000,
    version_group: "g1",
    version: 1,
    is_current: true,
    room_id: null,
    task_id: null,
    uploaded_by: null,
    archived_at: null,
    created_at: daysAgo(1),
    url: "",
    ...patch,
  };
}

describe("categories", () => {
  it("are exactly the six, in tab order", () => {
    expect([...DOCUMENT_CATEGORIES]).toEqual(["contract", "estimate", "invoices", "installation_photos", "warranties", "manuals"]);
  });

  it("only contract and estimate are versioned", () => {
    expect(DOCUMENT_CATEGORIES.filter(isVersionedCategory)).toEqual(["contract", "estimate"]);
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
      file("a.heic", "image/heic"),
      file("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      file("a.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ];
    for (const f of ok) expect(validateDocumentFile(f), f.name).toBeNull();
    expect(ALLOWED_DOCUMENT_MIME_TYPES).toHaveLength(7);
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
    expect(documentStoragePath("p1", "installation_photos", "u-2", "x.jpeg")).toBe("p1/installation_photos/u-2.jpeg");
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

  it("previews images except HEIC", () => {
    expect(canPreviewImage("image/jpeg")).toBe(true);
    expect(canPreviewImage("image/heic")).toBe(false);
    expect(canPreviewImage("application/pdf")).toBe(false);
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
    doc({ id: "c", category: "invoices", archived_at: daysAgo(1), created_at: daysAgo(2) }),
    doc({ id: "d", category: "manuals" }),
  ];

  it("lists a category newest first and hides archived unless asked", () => {
    expect(documentsOf(docs, "invoices", false).map((d) => d.id)).toEqual(["b", "a"]);
    expect(documentsOf(docs, "invoices", true).map((d) => d.id)).toEqual(["b", "c", "a"]);
  });

  it("counts per category", () => {
    expect(countByCategory(docs, false)).toMatchObject({ invoices: 2, manuals: 1, contract: 0 });
    expect(countByCategory(docs, true).invoices).toBe(3);
  });
});

describe("groupVersions", () => {
  const v = (id: string, version: number, current: boolean, group = "g1", extra: Partial<ProjectDocument> = {}) =>
    doc({ id, category: "contract", version_group: group, version, is_current: current, created_at: daysAgo(10 - version), ...extra });

  it("shows the current version and the older ones as history, newest first", () => {
    const [g] = groupVersions([v("v1", 1, false), v("v3", 3, true), v("v2", 2, false)]);
    expect(g.current.id).toBe("v3");
    expect(g.history.map((d) => d.id)).toEqual(["v2", "v1"]);
  });

  it("keeps separate documents apart, newest current first", () => {
    const groups = groupVersions([v("a1", 1, true, "ga", { created_at: daysAgo(9) }), v("b1", 1, true, "gb", { created_at: daysAgo(2) })]);
    expect(groups.map((g) => g.group)).toEqual(["gb", "ga"]);
  });

  it("falls back to the newest version when none is current (all archived)", () => {
    const [g] = groupVersions([v("v1", 1, false, "g1", { archived_at: daysAgo(1) }), v("v2", 2, false, "g1", { archived_at: daysAgo(1) })]);
    expect(g.current.id).toBe("v2");
    expect(g.history.map((d) => d.id)).toEqual(["v1"]);
  });

  it("a one-version document has no history", () => {
    expect(groupVersions([v("only", 1, true)])[0].history).toEqual([]);
  });
});

describe("groupByRoom", () => {
  it("groups by room in the given room order, rooms without a match last", () => {
    const photos = [
      doc({ id: "k", room_id: "kitchen", created_at: daysAgo(1) }),
      doc({ id: "l1", room_id: "living", created_at: daysAgo(3) }),
      doc({ id: "l2", room_id: "living", created_at: daysAgo(2) }),
      doc({ id: "x", room_id: null }),
    ];
    const groups = groupByRoom(photos, ["living", "kitchen"]);
    expect(groups.map((g) => g.roomId)).toEqual(["living", "kitchen", null]);
    expect(groups[0].photos.map((p) => p.id)).toEqual(["l2", "l1"]);
  });
});

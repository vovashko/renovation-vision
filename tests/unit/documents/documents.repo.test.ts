import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  bucket: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  DOCUMENTS_BUCKET: "project-documents",
  supabase: {
    storage: {
      from: (bucket: string) => {
        h.bucket(bucket);
        return { upload: h.upload, remove: h.remove, createSignedUrl: h.createSignedUrl };
      },
    },
    from: (table: string) => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: h.rows, error: null, table }) }) }),
      insert: (v: unknown) => h.insert(table, v),
      update: (v: unknown) => ({ eq: (col: string, id: string) => h.update(table, v, col, id) }),
    }),
  },
}));

import { documentsRepo, toDocument } from "@/features/documents/data/documents.repo";

const row = (patch: Record<string, unknown> = {}) => ({
  id: "d1",
  project_id: "p1",
  category: "contract",
  description: "",
  storage_path: "p1/contract/a.pdf",
  file_name: "umowa.pdf",
  mime_type: "application/pdf",
  size_bytes: 10,
  extra_column: "ignored",
  uploaded_by: "u1",
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
  ...patch,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-4111-8111-111111111111");
  h.rows = [];
  h.upload.mockResolvedValue({ data: {}, error: null });
  h.insert.mockResolvedValue({ error: null });
  h.update.mockResolvedValue({ data: null, error: null });
  h.remove.mockResolvedValue({ data: [], error: null });
});

describe("toDocument", () => {
  it("keeps the columns the UI reads and drops the rest", () => {
    const d = toDocument(row() as never);
    expect(d).toMatchObject({ id: "d1", file_name: "umowa.pdf", category: "contract" });
    expect(d).not.toHaveProperty("updated_at");
    expect(d).not.toHaveProperty("extra_column");
    expect(d).not.toHaveProperty("title");
  });
});

describe("listDocuments", () => {
  it("returns every row the caller may see, mapped, without touching storage", async () => {
    h.rows = [row({ id: "a" }), row({ id: "b", category: "invoices" })];
    const docs = await documentsRepo.listDocuments("p1");
    expect(docs.map((d) => d.id)).toEqual(["a", "b"]);
    expect(h.bucket).not.toHaveBeenCalled();
  });
});

describe("uploadDocument", () => {
  const input = (patch: Record<string, unknown> = {}) => ({
    file: new File(["x"], "Umowa końcowa.PDF", { type: "application/pdf" }),
    category: "contract" as const,
    description: "",
    ...patch,
  });

  it("uploads under <project>/<category>/<uuid>.<ext>, then inserts the row with the safe original file name", async () => {
    await documentsRepo.uploadDocument("p1", input());

    const path = "p1/contract/11111111-1111-4111-8111-111111111111.pdf";
    expect(h.upload).toHaveBeenCalledWith(path, expect.any(File), { contentType: "application/pdf", upsert: false });
    const [table, payload] = h.insert.mock.calls[0];
    expect(table).toBe("documents");
    expect(payload).toEqual({
      project_id: "p1",
      category: "contract",
      description: "",
      storage_path: path,
      file_name: "Umowa-koncowa.pdf",
      mime_type: "application/pdf",
      size_bytes: 1,
    });
    expect(h.upload.mock.invocationCallOrder[0]).toBeLessThan(h.insert.mock.invocationCallOrder[0]);
  });

  it("removes the uploaded object again when the row insert fails", async () => {
    h.insert.mockResolvedValue({ error: { message: "new row violates row-level security policy" } });
    await expect(documentsRepo.uploadDocument("p1", input())).rejects.toThrow("row-level security");
    expect(h.remove).toHaveBeenCalledWith(["p1/contract/11111111-1111-4111-8111-111111111111.pdf"]);
  });

  it("doesn't insert a row when the upload fails", async () => {
    h.upload.mockResolvedValue({ data: null, error: { message: "mime type not supported" } });
    await expect(documentsRepo.uploadDocument("p1", input())).rejects.toThrow("mime type not supported");
    expect(h.insert).not.toHaveBeenCalled();
  });
});

describe("update and download", () => {
  it("updates the description only", async () => {
    await documentsRepo.updateDescription("d1", "Signed copy");
    expect(h.update).toHaveBeenCalledWith("documents", { description: "Signed copy" }, "id", "d1");
  });

  it("has no archive and no direct delete (deleting goes through the server function)", () => {
    expect(documentsRepo).not.toHaveProperty("setArchived");
    expect(documentsRepo).not.toHaveProperty("deleteDocument");
  });

  it("downloads through a one-minute signed URL under the safe file name", async () => {
    h.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed/dl" }, error: null });
    const url = await documentsRepo.downloadUrl({ storage_path: "p1/contract/a.pdf", file_name: "Umowa.pdf" });
    expect(url).toBe("https://signed/dl");
    expect(h.createSignedUrl).toHaveBeenCalledWith("p1/contract/a.pdf", 60, { download: "Umowa.pdf" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrls: vi.fn(),
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
        return { upload: h.upload, remove: h.remove, createSignedUrls: h.createSignedUrls, createSignedUrl: h.createSignedUrl };
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
  category: "installation_photos",
  title: "Wiring",
  description: "",
  storage_path: "p1/installation_photos/a.jpg",
  file_name: "wiring.jpg",
  mime_type: "image/jpeg",
  size_bytes: 10,
  version_group: "g1",
  version: 1,
  is_current: true,
  is_new_extra: "ignored",
  room_id: "r1",
  task_id: null,
  uploaded_by: "u1",
  archived_at: null,
  archived_by: null,
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
  it("keeps the columns the UI reads and the thumbnail url, dropping the rest", () => {
    const d = toDocument(row() as never, "https://signed/a.jpg");
    expect(d).toMatchObject({ id: "d1", title: "Wiring", category: "installation_photos", room_id: "r1", url: "https://signed/a.jpg" });
    expect(d).not.toHaveProperty("updated_at");
    expect(d).not.toHaveProperty("archived_by");
    expect(d).not.toHaveProperty("is_new_extra");
    expect(toDocument(row() as never).url).toBe("");
  });
});

describe("listDocuments", () => {
  it("signs thumbnails only for previewable, non-archived installation photos", async () => {
    h.rows = [
      row({ id: "a", storage_path: "p1/installation_photos/a.jpg" }),
      row({ id: "b", storage_path: "p1/installation_photos/b.heic", mime_type: "image/heic" }),
      row({ id: "c", storage_path: "p1/installation_photos/c.jpg", archived_at: "2026-10-02T00:00:00Z" }),
      row({ id: "d", category: "invoices", storage_path: "p1/invoices/d.pdf", mime_type: "application/pdf" }),
    ];
    h.createSignedUrls.mockResolvedValue({ data: [{ path: "p1/installation_photos/a.jpg", signedUrl: "https://signed/a" }], error: null });

    const docs = await documentsRepo.listDocuments("p1");

    expect(h.bucket).toHaveBeenCalledWith("project-documents");
    expect(h.createSignedUrls).toHaveBeenCalledWith(["p1/installation_photos/a.jpg"], 3600);
    expect(docs.map((d) => [d.id, d.url])).toEqual([
      ["a", "https://signed/a"],
      ["b", ""],
      ["c", ""],
      ["d", ""],
    ]);
  });

  it("doesn't call storage when there is nothing to sign", async () => {
    h.rows = [row({ category: "invoices", mime_type: "application/pdf" })];
    await documentsRepo.listDocuments("p1");
    expect(h.createSignedUrls).not.toHaveBeenCalled();
  });
});

describe("uploadDocument", () => {
  const input = (patch: Record<string, unknown> = {}) => ({
    file: new File(["x"], "Umowa końcowa.PDF", { type: "application/pdf" }),
    category: "contract" as const,
    title: "Umowa",
    description: "",
    roomId: null,
    taskId: null,
    versionOf: null,
    ...patch,
  });

  it("uploads under <project>/<category>/<uuid>.<ext>, then inserts the row with a safe file name", async () => {
    await documentsRepo.uploadDocument("p1", input());

    const path = "p1/contract/11111111-1111-4111-8111-111111111111.pdf";
    expect(h.upload).toHaveBeenCalledWith(path, expect.any(File), { contentType: "application/pdf", upsert: false });
    const [table, payload] = h.insert.mock.calls[0];
    expect(table).toBe("documents");
    expect(payload).toMatchObject({
      project_id: "p1",
      category: "contract",
      title: "Umowa",
      storage_path: path,
      file_name: "Umowa-koncowa.pdf",
      mime_type: "application/pdf",
      size_bytes: 1,
      room_id: null,
      task_id: null,
    });
    expect(payload).not.toHaveProperty("version_group");
    expect(h.upload.mock.invocationCallOrder[0]).toBeLessThan(h.insert.mock.invocationCallOrder[0]);
  });

  it("a new version passes the existing version_group so the database keeps the old file as history", async () => {
    await documentsRepo.uploadDocument("p1", input({ versionOf: "group-1" }));
    expect(h.insert.mock.calls[0][1]).toMatchObject({ version_group: "group-1" });
    expect(h.remove).not.toHaveBeenCalled();
  });

  it("sends the room and work of an installation photo", async () => {
    await documentsRepo.uploadDocument(
      "p1",
      input({ category: "installation_photos", file: new File(["x"], "w.jpg", { type: "image/jpeg" }), roomId: "r1", taskId: "t1" }),
    );
    expect(h.insert.mock.calls[0][1]).toMatchObject({ room_id: "r1", task_id: "t1" });
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

describe("archive, update and download", () => {
  it("archives by setting archived_at and restores by clearing it (no delete exists)", async () => {
    await documentsRepo.setArchived("d1", true);
    const [table, patch, col, id] = h.update.mock.calls[0];
    expect([table, col, id]).toEqual(["documents", "id", "d1"]);
    expect(typeof (patch as { archived_at: string }).archived_at).toBe("string");

    await documentsRepo.setArchived("d1", false);
    expect(h.update.mock.calls[1][1]).toEqual({ archived_at: null });
    expect(documentsRepo).not.toHaveProperty("deleteDocument");
  });

  it("updates only the fields it is given", async () => {
    await documentsRepo.updateDocument("d1", { title: "New", room_id: "r2" });
    expect(h.update).toHaveBeenCalledWith("documents", { title: "New", room_id: "r2" }, "id", "d1");
  });

  it("downloads through a one-minute signed URL under the safe file name", async () => {
    h.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed/dl" }, error: null });
    const url = await documentsRepo.downloadUrl({ storage_path: "p1/contract/a.pdf", file_name: "Umowa.pdf" });
    expect(url).toBe("https://signed/dl");
    expect(h.createSignedUrl).toHaveBeenCalledWith("p1/contract/a.pdf", 60, { download: "Umowa.pdf" });
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ProjectDocument } from "@/lib/database.types";

const NOW = new Date("2026-10-08T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const h = vi.hoisted(() => ({
  docs: [] as unknown[],
  download: vi.fn(),
  remove: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("@/features/documents/hooks", () => ({
  useDocuments: () => ({ data: h.docs, isLoading: false }),
  useDownloadDocument: () => ({ mutate: h.download }),
  useDeleteDocument: () => ({ mutate: h.remove }),
}));
vi.mock("@/features/documents/hooks/use-documents", () => ({
  useUploadDocument: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateDocument: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/shared/ui/use-confirm", () => ({ useConfirm: () => h.confirm }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { DocumentsPanel } from "@/features/documents/ui/documents-panel";

function doc(patch: Partial<ProjectDocument>): ProjectDocument {
  return {
    id: "d",
    project_id: "p1",
    category: "invoices",
    description: "",
    storage_path: "p1/invoices/d.pdf",
    file_name: "doc.pdf",
    mime_type: "application/pdf",
    size_bytes: 2048,
    uploaded_by: null,
    created_at: daysAgo(30),
    ...patch,
  };
}

const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>
);
const selectTab = (name: RegExp) => {
  const tab = screen.getByRole("tab", { name });
  fireEvent.mouseDown(tab, { button: 0 });
  fireEvent.click(tab);
};

beforeEach(() => {
  vi.clearAllMocks();
  h.confirm.mockResolvedValue(true);
  h.docs = [
    doc({ id: "c1", category: "contract", file_name: "Contract.pdf", created_at: daysAgo(40) }),
    doc({ id: "c2", category: "contract", file_name: "Annex 1.pdf", created_at: daysAgo(2) }),
    doc({ id: "i1", category: "invoices", file_name: "Invoice fresh.pdf", created_at: daysAgo(1) }),
    doc({ id: "i2", category: "invoices", file_name: "Invoice old.pdf", created_at: daysAgo(20) }),
    doc({ id: "w1", category: "warranties", file_name: "Boiler warranty.pdf", description: "Valid until 2031", created_at: daysAgo(10) }),
  ];
});

describe("DocumentsPanel as the client", () => {
  it("shows the five category tabs with counts, the contract tab labelled 'Contract and amendments'", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Contract and amendments2",
      "Estimate0",
      "Invoices2",
      "Warranties1",
      "Device manuals0",
    ]);
  });

  it("lists plain documents by their file name, newest first, with no versions or history", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    const items = screen.getAllByTestId("document-item");
    expect(items.map((i) => within(i).getByText(/\.pdf$/).textContent)).toEqual(["Annex 1.pdf", "Contract.pdf"]);
    expect(screen.queryByText(/version/i)).toBeNull();
  });

  it("offers download only: no upload, edit or delete", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    expect(screen.queryByRole("button", { name: "Add document" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete / })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Download Annex 1.pdf" }));
    expect(h.download).toHaveBeenCalledWith(expect.objectContaining({ id: "c2" }));
  });

  it("marks only documents added within 7 days as new, and shows date, type and size", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    selectTab(/^Invoices/);
    const [fresh, old] = screen.getAllByTestId("document-item");
    expect(within(fresh).getByText("Invoice fresh.pdf")).toBeInTheDocument();
    expect(within(fresh).getByText("New")).toBeInTheDocument();
    expect(within(old).queryByText("New")).toBeNull();
    expect(within(old).getByText(/PDF · 2 KB/)).toBeInTheDocument();
  });

  it("lists warranties with their description", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    selectTab(/^Warranties/);
    expect(screen.getByText("Boiler warranty.pdf")).toBeInTheDocument();
    expect(screen.getByText("Valid until 2031")).toBeInTheDocument();
  });

  it("has no installation photos tab and no archive toggle", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    expect(screen.queryByRole("tab", { name: /installation/i })).toBeNull();
    expect(screen.queryByLabelText(/archived/i)).toBeNull();
  });

  it("shows an empty state for a category without documents", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    selectTab(/^Estimate/);
    expect(screen.getByText("No documents here yet")).toBeInTheDocument();
    expect(screen.getByText("Your site manager hasn't added anything to this category yet.")).toBeInTheDocument();
  });

  it("shows no payment status or amount on invoices", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    selectTab(/^Invoices/);
    expect(screen.queryByText(/paid|unpaid|zł|PLN|amount/i)).toBeNull();
  });
});

describe("DocumentsPanel as the site manager", () => {
  it("can add a document; there is no 'new version' action", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager now={NOW} />));
    expect(screen.getByRole("button", { name: "Add document" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new version/i })).toBeNull();
  });

  it("deletes after confirming", async () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager now={NOW} />));
    selectTab(/^Invoices/);
    fireEvent.click(screen.getByRole("button", { name: "Delete Invoice fresh.pdf" }));
    await vi.waitFor(() => expect(h.remove).toHaveBeenCalledWith(expect.objectContaining({ id: "i1" })));
    expect(h.confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
  });

  it("doesn't delete when the confirmation is declined", async () => {
    h.confirm.mockResolvedValue(false);
    render(wrap(<DocumentsPanel projectId="p1" isManager now={NOW} />));
    selectTab(/^Invoices/);
    fireEvent.click(screen.getByRole("button", { name: "Delete Invoice old.pdf" }));
    await vi.waitFor(() => expect(h.confirm).toHaveBeenCalled());
    expect(h.remove).not.toHaveBeenCalled();
  });

  it("offers no archive", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager now={NOW} />));
    expect(screen.queryByRole("button", { name: /archive|restore/i })).toBeNull();
  });
});

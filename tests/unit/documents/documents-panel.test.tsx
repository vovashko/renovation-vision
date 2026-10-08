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
  archive: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("@/features/documents/hooks", () => ({
  useDocuments: () => ({ data: h.docs, isLoading: false }),
  useDownloadDocument: () => ({ mutate: h.download }),
  useArchiveDocument: () => ({ mutate: h.archive }),
  useUploadDocument: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateDocument: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/features/documents/hooks/use-documents", () => ({
  useUploadDocument: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateDocument: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/features/work/hooks", () => ({
  useRooms: () => ({
    data: [
      { id: "r1", name: "Kitchen" },
      { id: "r2", name: "Bathroom" },
    ],
  }),
  useStages: () => ({ data: [{ id: "s1", name: "Electrics", tasks: [{ id: "t1", name: "Rewire kitchen" }] }] }),
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
    title: "Doc",
    description: "",
    storage_path: "p1/invoices/d.pdf",
    file_name: "doc.pdf",
    mime_type: "application/pdf",
    size_bytes: 2048,
    version_group: "g",
    version: 1,
    is_current: true,
    room_id: null,
    task_id: null,
    uploaded_by: null,
    archived_at: null,
    created_at: daysAgo(30),
    url: "",
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
    doc({
      id: "c1",
      category: "contract",
      title: "Contract v1",
      version_group: "gc",
      version: 1,
      is_current: false,
      created_at: daysAgo(40),
    }),
    doc({
      id: "c2",
      category: "contract",
      title: "Contract v2",
      version_group: "gc",
      version: 2,
      is_current: true,
      created_at: daysAgo(2),
    }),
    doc({ id: "i1", category: "invoices", title: "Invoice fresh", created_at: daysAgo(1) }),
    doc({ id: "i2", category: "invoices", title: "Invoice old", created_at: daysAgo(20) }),
    doc({ id: "i3", category: "invoices", title: "Invoice archived", created_at: daysAgo(25), archived_at: daysAgo(3), is_current: false }),
    doc({ id: "w1", category: "warranties", title: "Boiler warranty", description: "Valid until 2031", created_at: daysAgo(10) }),
    doc({
      id: "p1",
      category: "installation_photos",
      title: "Kitchen wiring",
      room_id: "r1",
      task_id: "t1",
      mime_type: "image/jpeg",
      url: "https://signed/p1.jpg",
      created_at: daysAgo(1),
    }),
    doc({
      id: "p2",
      category: "installation_photos",
      title: "Bath pipes",
      room_id: "r2",
      mime_type: "image/jpeg",
      url: "https://signed/p2.jpg",
      created_at: daysAgo(12),
    }),
  ];
});

describe("DocumentsPanel as the investor", () => {
  it("shows the six category tabs with counts (archived excluded)", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Contract2",
      "Estimate0",
      "Invoices2",
      "Installation photos before covering2",
      "Warranties1",
      "Device manuals0",
    ]);
  });

  it("shows the current contract version and the older one as history", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    expect(screen.getByText("Contract v2")).toBeInTheDocument();
    expect(screen.getByText("Current · version 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Earlier version (1)" }));
    expect(screen.getByText("Contract v1")).toBeInTheDocument();
    expect(screen.getByText("Version 1")).toBeInTheDocument();
  });

  it("offers download only: no upload, edit, archive or new version", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    expect(screen.queryByRole("button", { name: "Add document" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Upload new version" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Archive / })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Download Contract v2" }));
    expect(h.download).toHaveBeenCalledWith(expect.objectContaining({ id: "c2" }));
  });

  it("marks only documents added within 7 days as new, and shows date, type and size", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    selectTab(/^Invoices/);
    const [fresh, old] = screen.getAllByTestId("document-item");
    expect(within(fresh).getByText("Invoice fresh")).toBeInTheDocument();
    expect(within(fresh).getByText("New")).toBeInTheDocument();
    expect(within(old).queryByText("New")).toBeNull();
    expect(within(old).getByText(/PDF · 2 KB/)).toBeInTheDocument();
  });

  it("hides archived documents and has no toggle to show them", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    selectTab(/^Invoices/);
    expect(screen.queryByText("Invoice archived")).toBeNull();
    expect(screen.queryByLabelText("Show archived documents")).toBeNull();
  });

  it("lists warranties with their description", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    selectTab(/^Warranties/);
    expect(screen.getByText("Boiler warranty")).toBeInTheDocument();
    expect(screen.getByText("Valid until 2031")).toBeInTheDocument();
  });

  it("shows installation photos as a gallery grouped by room, with the work", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager={false} now={NOW} />));
    selectTab(/^Installation photos/);
    const kitchen = screen.getByRole("region", { name: "Kitchen" });
    expect(within(kitchen).getByAltText("Kitchen wiring")).toHaveAttribute("src", "https://signed/p1.jpg");
    expect(within(kitchen).getByText("Electrics: Rewire kitchen")).toBeInTheDocument();
    expect(within(kitchen).getByText("New")).toBeInTheDocument();
    const bath = screen.getByRole("region", { name: "Bathroom" });
    expect(within(bath).getByAltText("Bath pipes")).toBeInTheDocument();
    expect(within(bath).queryByText("New")).toBeNull();
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
  it("can add a document and upload a new version of a contract", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager now={NOW} />));
    expect(screen.getByRole("button", { name: "Add document" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload new version" })).toBeInTheDocument();
  });

  it("archives after confirming, and the archived list is behind a toggle", async () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager now={NOW} />));
    selectTab(/^Invoices/);
    expect(screen.queryByText("Invoice archived")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Archive Invoice fresh" }));
    await vi.waitFor(() => expect(h.archive).toHaveBeenCalledWith({ id: "i1", archived: true }));
    expect(h.confirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("Show archived documents"));
    expect(screen.getByText("Invoice archived")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore Invoice archived" }));
    await vi.waitFor(() => expect(h.archive).toHaveBeenCalledWith({ id: "i3", archived: false }));
    expect(h.confirm).toHaveBeenCalledTimes(1); // restoring needs no confirmation
  });

  it("doesn't archive when the confirmation is declined", async () => {
    h.confirm.mockResolvedValue(false);
    render(wrap(<DocumentsPanel projectId="p1" isManager now={NOW} />));
    selectTab(/^Invoices/);
    fireEvent.click(screen.getByRole("button", { name: "Archive Invoice old" }));
    await vi.waitFor(() => expect(h.confirm).toHaveBeenCalled());
    expect(h.archive).not.toHaveBeenCalled();
  });

  it("offers no delete anywhere", () => {
    render(wrap(<DocumentsPanel projectId="p1" isManager now={NOW} />));
    selectTab(/^Invoices/);
    expect(screen.queryByRole("button", { name: /delete|remove/i })).toBeNull();
  });
});

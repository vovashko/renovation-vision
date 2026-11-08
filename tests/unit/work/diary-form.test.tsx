import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// The diary form against a mocked repository; photo upload goes through the media feature's hook (mocked too).
const h = vi.hoisted(() => ({
  saveEntry: vi.fn(),
  setEntryMaterials: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@/features/work/data/diary.repo", () => ({
  diaryRepo: {
    listEntries: async () => [],
    listMaterials: async () => [
      { id: "m1", name: "Primer", quantity: 2, unit: "l", progress_entry_id: null },
      { id: "m2", name: "Paint", quantity: 5, unit: "l", progress_entry_id: null },
    ],
    saveEntry: h.saveEntry,
    setEntryMaterials: h.setEntryMaterials,
    deleteEntry: async () => {},
  },
}));
vi.mock("@/features/media/hooks", () => ({
  useUploadPhotos: () => ({ mutateAsync: h.upload, isPending: false }),
  usePhotos: () => ({ data: [] }),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { DiaryEntryForm } from "@/features/work/ui/diary-entry-form";

function wrap({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  h.saveEntry.mockReset().mockResolvedValue("e1");
  h.setEntryMaterials.mockReset().mockResolvedValue(undefined);
  h.upload.mockReset().mockResolvedValue(undefined);
});

describe("DiaryEntryForm", () => {
  it("saves the entry, links the picked materials and uploads photos with the entry id", async () => {
    const onSaved = vi.fn();
    render(<DiaryEntryForm projectId="p1" stages={[]} rooms={[]} onSaved={onSaved} />, { wrapper: wrap });

    fireEvent.change(screen.getByLabelText("What happened"), { target: { value: "Primed the walls" } });
    fireEvent.change(screen.getByLabelText("Hours"), { target: { value: "2,5" } });
    fireEvent.click(await screen.findByRole("checkbox", { name: "Primer" }));
    const photo = new File(["x"], "wall.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Photos"), { target: { files: [photo] } });
    fireEvent.click(screen.getByRole("switch", { name: "Visible to the client" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(h.saveEntry).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ note: "Primed the walls", hours: 2.5, is_visible: true, stage_id: null }),
    );
    expect(h.setEntryMaterials).toHaveBeenCalledWith("e1", ["m1"], []);
    expect(h.upload).toHaveBeenCalledWith(
      expect.objectContaining({ files: [photo], publish: true, meta: expect.objectContaining({ progress_entry_id: "e1" }) }),
    );
  });

  it("does not save without a note", async () => {
    render(<DiaryEntryForm projectId="p1" stages={[]} rooms={[]} onSaved={vi.fn()} />, { wrapper: wrap });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText(/required/i)).toBeInTheDocument());
    expect(h.saveEntry).not.toHaveBeenCalled();
  });

  it("skips the upload when no photo was chosen", async () => {
    const onSaved = vi.fn();
    render(<DiaryEntryForm projectId="p1" stages={[]} rooms={[]} onSaved={onSaved} />, { wrapper: wrap });
    fireEvent.change(screen.getByLabelText("What happened"), { target: { value: "Cleaned up" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(h.upload).not.toHaveBeenCalled();
  });
});

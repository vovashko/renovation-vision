import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// No vitest globals, so Testing Library can't register its own cleanup.
afterEach(cleanup);

describe("Empty", () => {
  it("renders the title, description and actions", () => {
    render(
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon" icon="photo_camera" />
          <EmptyTitle>No photos yet</EmptyTitle>
          <EmptyDescription>Photos from the site will show up here.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <button type="button">Upload</button>
        </EmptyContent>
      </Empty>,
    );
    expect(screen.getByRole("heading", { name: "No photos yet" })).toBeInTheDocument();
    expect(screen.getByText("Photos from the site will show up here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("EmptyMedia icon variant renders the Material Symbols name in a round tile", () => {
    const { container } = render(<EmptyMedia variant="icon" icon="photo_camera" />);
    const glyph = screen.getByText("photo_camera");
    expect(glyph.className).toContain("material-symbols-outlined");
    expect(glyph).toHaveAttribute("aria-hidden");
    const tile = container.querySelector("[data-slot=empty-media]");
    expect(tile?.className).toContain("rounded-full");
    expect(tile?.className).toContain("bg-surface-container-high");
  });

  it("uses the dashed v5 box, with a muted variant for panels", () => {
    const { container, rerender } = render(<Empty />);
    const box = () => container.querySelector("[data-slot=empty]")!;
    expect(box().className).toContain("border-dashed");
    expect(box().className).toContain("border-outline-variant");
    expect(box().className).toContain("bg-surface-container-lowest");
    rerender(<Empty variant="muted" />);
    expect(box().className).toContain("bg-surface-container-low");
    expect(box()).toHaveAttribute("data-variant", "muted");
  });
});

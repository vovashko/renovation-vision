import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";

// No vitest globals, so Testing Library can't register its own cleanup.
afterEach(cleanup);

describe("SegmentedControl", () => {
  it("renders a tablist wrapper with the pill track", () => {
    render(
      <SegmentedControl role="tablist" aria-label="Mode">
        <SegmentedControlItem active>People</SegmentedControlItem>
        <SegmentedControlItem>AI</SegmentedControlItem>
      </SegmentedControl>,
    );
    const list = screen.getByRole("tablist", { name: "Mode" });
    expect(list.className).toContain("rounded-full");
    expect(list.className).toContain("bg-on-surface/12");
  });
});

describe("SegmentedControlItem", () => {
  it("the active segment gets the raised fill and data-active", () => {
    render(<SegmentedControlItem active>People</SegmentedControlItem>);
    const item = screen.getByRole("button", { name: "People" });
    expect(item).toHaveAttribute("data-active", "true");
    expect(item.className).toContain("bg-surface-container");
    expect(item.className).toContain("font-medium");
  });

  it("an inactive segment has no fill and shows a hover state layer instead", () => {
    render(<SegmentedControlItem>AI</SegmentedControlItem>);
    const item = screen.getByRole("button", { name: "AI" });
    expect(item).toHaveAttribute("data-active", "false");
    expect(item.className).not.toContain("font-medium");
    expect(item.className).toContain("hover:bg-on-surface/8");
  });

  it("defaults to type=button so it never submits a form", () => {
    render(<SegmentedControlItem>AI</SegmentedControlItem>);
    expect(screen.getByRole("button", { name: "AI" })).toHaveAttribute("type", "button");
  });
});

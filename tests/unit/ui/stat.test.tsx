import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Stat, StatChange, StatDelta, StatLabel, StatValue } from "@/components/ui/stat";

// No vitest globals, so Testing Library can't register its own cleanup.
afterEach(cleanup);

describe("Stat", () => {
  it("renders the label, value and a grayed unit", () => {
    const { container } = render(
      <Stat>
        <StatLabel>Stages done</StatLabel>
        <StatValue unit="/ 7">2</StatValue>
        <StatChange>
          <StatDelta tone="good">↑ 1</StatDelta>
          since last week
        </StatChange>
      </Stat>,
    );
    expect(screen.getByText("Stages done")).toBeInTheDocument();
    const value = container.querySelector("[data-slot=stat-value]")!;
    expect(value).toHaveTextContent("2 / 7");
    expect(value.className).toContain("text-headline-md");
    const unit = container.querySelector("[data-slot=stat-unit]")!;
    expect(unit).toHaveTextContent("/ 7");
    expect(unit.className).toContain("text-title-md");
    expect(unit.className).toContain("text-on-surface-variant");
    expect(screen.getByText("since last week")).toBeInTheDocument();
  });

  it("keeps the unit on-surface with unitTone=default", () => {
    const { container } = render(
      <StatValue unit="k€" unitTone="default">
        88.1
      </StatValue>,
    );
    const unit = container.querySelector("[data-slot=stat-unit]")!;
    expect(unit.className).toContain("text-on-surface");
    expect(unit.className).not.toContain("text-on-surface-variant");
  });

  it("colours StatDelta by tone", () => {
    render(
      <>
        <StatDelta tone="good">good</StatDelta>
        <StatDelta tone="attention">attention</StatDelta>
        <StatDelta tone="neutral">neutral</StatDelta>
      </>,
    );
    expect(screen.getByText("good").className).toContain("text-success-text");
    expect(screen.getByText("attention").className).toContain("text-attention-text");
    expect(screen.getByText("neutral").className).toContain("text-on-surface");
    for (const t of ["good", "attention", "neutral"]) expect(screen.getByText(t).className).toContain("font-medium");
  });

  it("is a default card with stat padding; the attention variant swaps in the attention outline", () => {
    const { container, rerender } = render(<Stat />);
    const card = () => container.querySelector("[data-slot=stat]")!;
    expect(card().className).toContain("border-outline-variant");
    expect(card().className).toContain("px-5");
    expect(card().className).toContain("py-4");
    rerender(
      <Stat variant="attention">
        <StatLabel>Budget spent</StatLabel>
      </Stat>,
    );
    expect(card().className).toContain("border-attention-outline");
    expect(card().className).not.toContain("border-outline-variant");
    expect(card()).toHaveAttribute("data-variant", "attention");
  });
});

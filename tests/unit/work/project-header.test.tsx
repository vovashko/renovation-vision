import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProjectHeader } from "@/features/work/ui/project-header";

afterEach(cleanup);

const props = { name: "Elm Road", address: "Elm Road 1", progress: 40 };

describe("ProjectHeader progress bar", () => {
  it("is red when the project is behind schedule", () => {
    render(<ProjectHeader {...props} behind />);
    expect(screen.getByRole("progressbar").className).toMatch(/bg-status-blocked/);
  });

  it("keeps the default colour when on schedule", () => {
    render(<ProjectHeader {...props} />);
    expect(screen.getByRole("progressbar").className).not.toMatch(/bg-status-blocked/);
  });
});

describe("ProjectHeader alerts", () => {
  it("renders alerts inside the card, after the progress block", () => {
    render(<ProjectHeader {...props} alerts={<p>Delivery delayed</p>} />);
    const alert = screen.getByText("Delivery delayed");
    const bar = screen.getByRole("progressbar");
    // The alert's wrapper is a direct child of the card, which also holds the progress block.
    const card = alert.parentElement?.parentElement as HTMLElement;
    expect(card.contains(bar)).toBe(true);
    expect(bar.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

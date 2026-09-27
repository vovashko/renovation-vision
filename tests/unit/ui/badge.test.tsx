import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("status-done variant fills the status-done container", () => {
    render(<Badge variant="status-done">Done</Badge>);
    expect(screen.getByText("Done").className).toContain("bg-status-done-container");
  });

  it("scrim variant is dark and readable on a photo", () => {
    render(<Badge variant="scrim">Now</Badge>);
    const badge = screen.getByText("Now");
    expect(badge.className).toContain("bg-inverse-surface");
    expect(badge.className).toContain("text-inverse-on-surface");
  });
});

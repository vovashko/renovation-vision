import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AvatarInitials } from "@/components/ui/avatar-initials";

// No vitest globals, so Testing Library can't register its own cleanup.
afterEach(cleanup);

describe("AvatarInitials", () => {
  it("renders the given initials text, hidden from the accessibility tree", () => {
    render(<AvatarInitials initials="JW" />);
    const tile = screen.getByText("JW");
    expect(tile).toHaveAttribute("aria-hidden");
    expect(tile.className).toContain("rounded-full");
    expect(tile.className).toContain("size-10");
  });

  it("the default 'surface' tone is a white fill for sitting on a tinted panel", () => {
    render(<AvatarInitials initials="JW" />);
    const tile = screen.getByText("JW");
    expect(tile.className).toContain("bg-surface-container-lowest");
    expect(tile.className).toContain("text-on-surface");
  });

  it("the 'primary-container' tone uses the container fill", () => {
    render(<AvatarInitials initials="SB" tone="primary-container" />);
    const tile = screen.getByText("SB");
    expect(tile.className).toContain("bg-primary-container");
    expect(tile.className).toContain("text-on-primary-container");
  });
});

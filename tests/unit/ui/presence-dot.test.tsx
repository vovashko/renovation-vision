import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PresenceDot } from "@/components/ui/presence-dot";

// No vitest globals, so Testing Library can't register its own cleanup.
afterEach(cleanup);

describe("PresenceDot", () => {
  it("is a small hidden-from-a11y dot", () => {
    const { container } = render(<PresenceDot online />);
    const dot = container.firstElementChild!;
    expect(dot).toHaveAttribute("aria-hidden");
    expect(dot.className).toContain("size-2");
    expect(dot.className).toContain("rounded-full");
  });

  it("online uses the success color", () => {
    const { container } = render(<PresenceDot online />);
    expect(container.firstElementChild?.className).toContain("bg-success");
  });

  it("offline (the default) uses a muted color", () => {
    const { container } = render(<PresenceDot />);
    expect(container.firstElementChild?.className).toContain("bg-on-surface-variant/40");
  });
});

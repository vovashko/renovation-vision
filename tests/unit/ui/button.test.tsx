import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("default variant uses the primary fill", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("text-on-primary");
  });

  it("tonal variant uses the secondary container", () => {
    render(<Button variant="tonal">Tonal</Button>);
    const button = screen.getByRole("button", { name: "Tonal" });
    expect(button.className).toContain("bg-secondary-container");
    expect(button.className).toContain("text-on-secondary-container");
  });

  it("outline variant has an outline-variant border on the lowest surface", () => {
    render(<Button variant="outline">Outline</Button>);
    const button = screen.getByRole("button", { name: "Outline" });
    expect(button.className).toContain("border-outline-variant");
    expect(button.className).toContain("bg-surface-container-lowest");
  });

  it("ghost variant is transparent with primary-colored text", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole("button", { name: "Ghost" });
    expect(button.className).toContain("bg-transparent");
    expect(button.className).toContain("text-primary");
  });

  it("destructive variant uses the error color", () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.className).toContain("bg-error");
    expect(button.className).toContain("text-on-error");
  });

  it("icon size is a round 44px button", () => {
    render(<Button size="icon" aria-label="Close" />);
    const button = screen.getByRole("button", { name: "Close" });
    expect(button.className).toContain("size-11");
    expect(button.className).toContain("rounded-full");
  });
});

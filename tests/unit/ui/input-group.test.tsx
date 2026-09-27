import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InputGroupButton } from "@/components/ui/input-group";

describe("InputGroupButton", () => {
  it("defaults to the 32px inline icon-sm size", () => {
    render(<InputGroupButton aria-label="Remove" />);
    expect(screen.getByRole("button", { name: "Remove" }).className).toContain("size-8");
  });

  it("size='icon' gives a full 44px touch target", () => {
    render(<InputGroupButton size="icon" aria-label="Send" />);
    const button = screen.getByRole("button", { name: "Send" });
    expect(button.className).toContain("size-11");
    expect(button.className).toContain("rounded-full");
  });
});

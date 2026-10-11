import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Banner } from "@/components/ui/banner";

describe("Banner", () => {
  it.each([
    ["attention", "warning", "bg-attention-container", "status"],
    ["info", "info", "bg-secondary-container", "status"],
    ["error", "error", "bg-error-container", "alert"],
  ] as const)("%s variant renders its tone, default icon and role", (variant, icon, cls, role) => {
    render(
      <Banner variant={variant} title="Heads up.">
        Details
      </Banner>,
    );
    const banner = screen.getByRole(role);
    expect(banner.className).toContain(cls);
    expect(banner.textContent).toContain(icon);
    expect(banner.textContent).toContain("Heads up. Details");
  });

  it("defaults to info, accepts a custom icon and renders the action", () => {
    render(<Banner icon="euro" action={<button>Review</button>} />);
    const banner = screen.getByRole("status");
    expect(banner.className).toContain("bg-secondary-container");
    expect(banner.textContent).toContain("euro");
    expect(screen.getByRole("button", { name: "Review" })).toBeTruthy();
  });
});

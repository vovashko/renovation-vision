import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Rail, RailContent, RailFooter, RailGroup, RailHeader, RailItem, RailLogo } from "@/components/ui/rail";

// No vitest globals, so Testing Library can't register its own cleanup.
afterEach(cleanup);

function renderRail() {
  return render(
    <Rail>
      <RailHeader>
        <RailLogo asChild mark="/mark.svg" lockup="/logo.svg">
          <a href="/" aria-label="RenoVision home" />
        </RailLogo>
      </RailHeader>
      <RailContent>
        <RailItem asChild icon="grid_view" label="Overview" active>
          <a href="/projects/1" />
        </RailItem>
        <RailItem asChild icon="checklist" label="Stages">
          <a href="/projects/1/stages" />
        </RailItem>
        <RailGroup position="end">
          <RailItem icon="settings" label="Settings" />
        </RailGroup>
      </RailContent>
      <RailFooter>
        <RailItem icon={<span data-testid="avatar">VS</span>} label="Vova" aria-label="Vova, open profile" aria-haspopup="dialog" />
      </RailFooter>
    </Rail>,
  );
}

describe("Rail", () => {
  it("renders a labelled nav landmark in the 96px slot, hidden on phones", () => {
    renderRail();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.className).toContain("w-24");
    expect(nav.className).toContain("hover:w-60");
    expect(nav.className).toContain("focus-within:w-60");
    expect(nav.className).toContain("motion-reduce:transition-none");
    expect(nav.parentElement?.className).toContain("hidden");
    expect(nav.parentElement?.className).toContain("md:block");
  });

  it("renders every item with its label as the accessible name", () => {
    renderRail();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-label", "Overview");
    expect(screen.getByRole("link", { name: "Stages" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toHaveAttribute("aria-label", "Settings");
    // The visible label is rendered too (it fades in on expand).
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  it("marks only the active item with aria-current=page and the active fill", () => {
    renderRail();
    const active = screen.getByRole("link", { name: "Overview" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active.className).toContain("bg-surface-container-high");
    const inactive = screen.getByRole("link", { name: "Stages" });
    expect(inactive).not.toHaveAttribute("aria-current");
    expect(inactive.className).toContain("hover:bg-surface");
  });

  it("asChild renders the given anchor, with the icon cell and label inside it", () => {
    renderRail();
    const link = screen.getByRole("link", { name: "Overview" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/projects/1");
    expect(link).toHaveTextContent("grid_view");
    expect(link).toHaveTextContent("Overview");
  });

  it("renders a type=button <button> without asChild, and lets aria-label be overridden", () => {
    renderRail();
    const settings = screen.getByRole("button", { name: "Settings" });
    expect(settings.tagName).toBe("BUTTON");
    expect(settings).toHaveAttribute("type", "button");
    const profile = screen.getByRole("button", { name: "Vova, open profile" });
    expect(profile).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.getByTestId("avatar")).toBeInTheDocument();
  });

  it("RailLogo asChild renders the link with both decorative images", () => {
    const { container } = renderRail();
    expect(screen.getByRole("link", { name: "RenoVision home" })).toHaveAttribute("href", "/");
    const imgs = container.querySelectorAll("a[href='/'] img");
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute("src", "/mark.svg");
    expect(imgs[1]).toHaveAttribute("src", "/logo.svg");
    expect(imgs[0]).toHaveAttribute("alt", "");
  });
});

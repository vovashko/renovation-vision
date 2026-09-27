import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";

// No vitest globals, so Testing Library can't register its own cleanup.
afterEach(cleanup);

describe("Item", () => {
  it("renders a room row: tile, title, description, trailing action", () => {
    const { container } = render(
      <ItemGroup>
        <Item>
          <ItemMedia variant="icon" icon="countertops" />
          <ItemContent>
            <ItemTitle>Kitchen</ItemTitle>
            <ItemDescription>8 open tasks</ItemDescription>
          </ItemContent>
          <ItemActions>
            <span>chevron</span>
          </ItemActions>
        </Item>
      </ItemGroup>,
    );
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("Kitchen").className).toContain("text-label-lg");
    expect(screen.getByText("8 open tasks").className).toContain("text-on-surface-variant");
    expect(screen.getByText("countertops").className).toContain("material-symbols-outlined");
    expect(screen.getByText("chevron")).toBeInTheDocument();

    const row = container.querySelector("[data-slot=item]")!;
    for (const c of ["rounded-lg", "bg-card", "border-outline-variant", "py-2", "pl-2", "pr-3.5", "gap-3"])
      expect(row.className).toContain(c);
    const tile = container.querySelector("[data-slot=item-media]")!;
    for (const c of ["size-11", "rounded-md", "bg-surface-container-high"]) expect(tile.className).toContain(c);
  });

  it("asChild renders the given link with the row styling and hover surface", () => {
    render(
      <Item asChild>
        <a href="/rooms/kitchen">
          <ItemContent>
            <ItemTitle>Kitchen</ItemTitle>
          </ItemContent>
        </a>
      </Item>,
    );
    const link = screen.getByRole("link", { name: "Kitchen" });
    expect(link).toHaveAttribute("href", "/rooms/kitchen");
    expect(link).toHaveAttribute("data-slot", "item");
    expect(link.className).toContain("bg-card");
    expect(link.className).toContain("[a]:hover:bg-surface-container-low");
  });

  it("ItemMedia tones fill the tile with the status container", () => {
    const { container } = render(<ItemMedia variant="icon" tone="done" icon="check" />);
    expect(container.firstElementChild?.className).toContain("bg-status-done-container");
  });

  it("lg size is the stage row", () => {
    const { container } = render(<Item size="lg" />);
    const row = container.firstElementChild!;
    for (const c of ["rounded-xl", "py-3.5", "pl-3.5", "pr-5", "gap-3.5"]) expect(row.className).toContain(c);
  });

  it("has no unconditional outline-none, so a selected outline isn't cancelled", () => {
    const { container } = render(<Item selected tone="progress" />);
    const row = container.firstElementChild!;
    expect(row.className).toContain("outline-2");
    expect(row.className).toContain("outline-status-progress");
    expect(row.className).not.toContain("outline-none");
  });

  it("selected outlines in the given status tone, unselected does not", () => {
    const { container: done } = render(<Item selected tone="done" />);
    expect(done.firstElementChild!.className).toContain("outline-status-done");
    const { container: plain } = render(<Item tone="done" />);
    expect(plain.firstElementChild!.className).not.toContain("outline-status-done");
  });

  it("attention adds the outline and a dot", () => {
    const { container } = render(<Item attention>content</Item>);
    const row = container.firstElementChild!;
    expect(row.className).toContain("border-attention-outline");
    expect(row.querySelector("[aria-hidden]")).toHaveClass("bg-attention");
  });

  it("attention works with asChild (a single dot, not a React.Children.only crash)", () => {
    render(
      <Item asChild attention>
        <a href="/x">Row</a>
      </Item>,
    );
    const link = screen.getByRole("link", { name: "Row" });
    expect(link.className).toContain("border-attention-outline");
    expect(link.querySelector("[aria-hidden]")).toHaveClass("bg-attention");
  });

  it("ItemTitle size=lg is bigger than the row's own lg title size", () => {
    render(<ItemTitle size="lg">Big</ItemTitle>);
    expect(screen.getByText("Big").className).toContain("text-title-lg");
  });
});

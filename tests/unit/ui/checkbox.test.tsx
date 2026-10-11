import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Checkbox, CheckboxReadOnly } from "@/components/ui/checkbox";

describe("CheckboxReadOnly", () => {
  it("is not interactive: no checkbox role, no button, clicks do nothing", () => {
    const { container } = render(<CheckboxReadOnly checked />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    fireEvent.click(container.firstElementChild!);
    expect(container.querySelector("[data-state]")).toBeNull();
  });

  it("shows a check when done and a dashed box when open", () => {
    const done = render(<CheckboxReadOnly checked />);
    expect(done.container.textContent).toContain("check");
    done.unmount();
    const open = render(<CheckboxReadOnly checked={false} />);
    expect(open.container.textContent).toBe("");
    expect(open.container.firstElementChild!.className).toContain("border-dashed");
  });

  it("the interactive Checkbox still toggles", () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="x" onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

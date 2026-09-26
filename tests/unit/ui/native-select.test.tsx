import type { ChangeEvent } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

// No vitest globals, so Testing Library can't register its own cleanup.
afterEach(cleanup);

function Example({ value, onChange }: { value: string; onChange: (e: ChangeEvent<HTMLSelectElement>) => void }) {
  return (
    <>
      <label htmlFor="status">Status</label>
      <NativeSelect id="status" value={value} onChange={onChange}>
        <NativeSelectOption value="pending">Not started</NativeSelectOption>
        <NativeSelectOption value="progress">In progress</NativeSelectOption>
        <NativeSelectOption value="done">Done</NativeSelectOption>
      </NativeSelect>
    </>
  );
}

describe("NativeSelect", () => {
  it("renders a native select with its options", () => {
    render(<Example value="pending" onChange={() => {}} />);
    const select = screen.getByRole("combobox");
    expect(select.tagName).toBe("SELECT");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Not started", "In progress", "Done"]);
  });

  it("forwards value and onChange", () => {
    // Read the value inside the handler: React restores a controlled select right after the event.
    const onChange = vi.fn((e: ChangeEvent<HTMLSelectElement>) => e.target.value);
    render(<Example value="progress" onChange={onChange} />);
    const select = screen.getByRole<HTMLSelectElement>("combobox");
    expect(select.value).toBe("progress");
    fireEvent.change(select, { target: { value: "done" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.results[0].value).toBe("done");
  });

  it("is associated with a <label htmlFor>", () => {
    render(<Example value="pending" onChange={() => {}} />);
    expect(screen.getByLabelText("Status").tagName).toBe("SELECT");
  });

  it("draws the text-field box with the expand_more chevron; className goes on the wrapper", () => {
    const { container } = render(
      <NativeSelect aria-label="Room" className="w-40">
        <NativeSelectOption>Kitchen</NativeSelectOption>
      </NativeSelect>,
    );
    const select = screen.getByRole("combobox", { name: "Room" });
    expect(select.className).toContain("h-11");
    expect(select.className).toContain("border-outline-variant");
    expect(select.className).toContain("appearance-none");
    expect(select.className).not.toContain("w-40");
    expect(container.querySelector("[data-slot=native-select-wrapper]")?.className).toContain("w-40");
    expect(screen.getByText("expand_more")).toHaveAttribute("aria-hidden");
  });
});

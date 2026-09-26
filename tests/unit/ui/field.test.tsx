import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

// No vitest globals, so Testing Library can't register its own cleanup.
afterEach(cleanup);

describe("Field", () => {
  it("associates the label with the control and renders the description", () => {
    render(
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="pd-name">Project name</FieldLabel>
          <Input id="pd-name" />
        </Field>
        <Field>
          <FieldLabel htmlFor="pd-status">Schedule status</FieldLabel>
          <NativeSelect id="pd-status">
            <NativeSelectOption value="on_track">On track</NativeSelectOption>
          </NativeSelect>
          <FieldDescription>Shown on the client's overview.</FieldDescription>
        </Field>
      </FieldGroup>,
    );
    expect(screen.getByLabelText("Project name").tagName).toBe("INPUT");
    expect(screen.getByLabelText("Schedule status").tagName).toBe("SELECT");
    const hint = screen.getByText("Shown on the client's overview.");
    expect(hint.className).toContain("text-body-sm");
    expect(hint.className).toContain("text-on-surface-variant");
  });

  it("styles the label with the v5 label type and groups the field", () => {
    render(
      <Field>
        <FieldLabel htmlFor="x">Budget</FieldLabel>
        <Input id="x" />
      </Field>,
    );
    expect(screen.getByText("Budget").className).toContain("text-label-lg");
    expect(screen.getByRole("group").className).toContain("gap-2");
  });

  it("FieldError renders children or de-duplicated errors as an alert, and nothing when empty", () => {
    const { rerender, container } = render(<FieldError errors={[{ message: "Required" }, { message: "Required" }]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
    expect(screen.getByRole("alert").className).toContain("text-error");
    rerender(<FieldError errors={[{ message: "Too short" }, { message: "Must be a number" }]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    rerender(<FieldError errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

import { useState } from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Field, NativeSelect } from "@/components/manager/form-sheet";

afterEach(cleanup);

describe("Field", () => {
  it("links its label to the control by id", () => {
    render(
      <Field id="tm-role" label="Role">
        <input id="tm-role" />
      </Field>,
    );
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
  });

  it("renders an optional hint", () => {
    render(
      <Field id="tm-email" label="Email" hint="They need an account first.">
        <input id="tm-email" />
      </Field>,
    );
    expect(screen.getByText("They need an account first.")).toBeInTheDocument();
  });
});

describe("NativeSelect", () => {
  it("renders its options", () => {
    render(
      <NativeSelect aria-label="Role" value="client" onChange={() => {}}>
        <option value="client">Client</option>
        <option value="manager">Manager</option>
      </NativeSelect>,
    );
    const select = screen.getByRole("combobox", { name: "Role" });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Client" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Manager" })).toBeInTheDocument();
  });

  it("forwards onChange", () => {
    function Wrapper() {
      const [value, setValue] = useState("client");
      return (
        <NativeSelect aria-label="Role" value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="client">Client</option>
          <option value="manager">Manager</option>
        </NativeSelect>
      );
    }
    render(<Wrapper />);
    const select = screen.getByRole("combobox", { name: "Role" }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "manager" } });
    expect(select.value).toBe("manager");
  });
});

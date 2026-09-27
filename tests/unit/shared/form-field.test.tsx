import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { createI18n } from "@/i18n/instance";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";

const schema = z.object({
  email: z.string().email("common:form.invalidEmail"),
  name: z.string().min(2, "At least two letters"),
});

function ExampleForm({ onSubmit }: { onSubmit: (values: z.output<typeof schema>) => void }) {
  const form = useZodForm(schema, { email: "", name: "" });
  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <FormField control={form.control} name="email" label="Email" description="We never share it.">
        {(field) => <Input type="email" {...field} />}
      </FormField>
      <FormField control={form.control} name="name" label="Name">
        {(field) => <Input {...field} />}
      </FormField>
      <button type="submit">Save</button>
    </form>
  );
}

function setup(locale: "en" | "pl" = "en") {
  const onSubmit = vi.fn();
  render(
    <I18nextProvider i18n={createI18n(locale)}>
      <ExampleForm onSubmit={onSubmit} />
    </I18nextProvider>,
  );
  return onSubmit;
}

describe("FormField + useZodForm", () => {
  it("associates the label and the description with the control", () => {
    setup();
    const email = screen.getByLabelText("Email");
    expect(email.tagName).toBe("INPUT");
    expect(email).toHaveAccessibleDescription("We never share it.");
    expect(screen.getByLabelText("Name")).not.toBe(email);
  });

  it("renders zod errors in FieldError, translating i18n keys", async () => {
    const onSubmit = setup();
    fireEvent.input(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.input(screen.getByLabelText("Name"), { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((a) => a.textContent)).toEqual(["Enter a valid email address", "At least two letters"]);
    expect(alerts[0]).toHaveAttribute("data-slot", "field-error");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("We never share it. Enter a valid email address");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("translates key messages into the current language", async () => {
    setup("pl");
    fireEvent.input(screen.getByLabelText("Email"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent("Podaj prawidłowy adres e-mail");
  });

  it("submits the parsed values once valid", async () => {
    const onSubmit = setup();
    fireEvent.input(screen.getByLabelText("Email"), { target: { value: "jonas@renovision.demo" } });
    fireEvent.input(screen.getByLabelText("Name"), { target: { value: "Jonas" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({ email: "jonas@renovision.demo", name: "Jonas" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

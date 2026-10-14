import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { useState } from "react";
import { createI18n } from "@/i18n/instance";
import { MoneyInput } from "@/components/ui/money-input";

afterEach(cleanup);

const plain = (s: string) => s.replace(/\s/g, " ");

function Harness({
  initial = null,
  onValue,
  ...props
}: { initial?: number | null; onValue?: (v: number | null) => void } & Partial<React.ComponentProps<typeof MoneyInput>>) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <MoneyInput
      aria-label="Amount"
      {...props}
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
    />
  );
}

const inLocale = (ui: React.ReactElement, locale: "en" | "pl" = "en") => <I18nextProvider i18n={createI18n(locale)}>{ui}</I18nextProvider>;

describe("MoneyInput", () => {
  it("shows the currency addon, PLN by default", () => {
    render(inLocale(<Harness />));
    expect(screen.getByText("PLN")).toBeTruthy();
    cleanup();
    render(inLocale(<Harness currency="EUR" />));
    expect(screen.getByText("EUR")).toBeTruthy();
  });

  it("groups per locale at rest and shows raw digits while focused", () => {
    render(inLocale(<Harness initial={100000} />, "pl"));
    const input = screen.getByLabelText("Amount") as HTMLInputElement;
    expect(plain(input.value)).toBe("100 000");
    fireEvent.focus(input);
    expect(input.value).toBe("100000");
    fireEvent.blur(input);
    expect(plain(input.value)).toBe("100 000");
  });

  it("groups with commas in English", () => {
    render(inLocale(<Harness initial={100000.5} />, "en"));
    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe("100,000.5");
  });

  it("emits a number, and null when emptied", () => {
    const onValue = vi.fn();
    render(inLocale(<Harness onValue={onValue} />, "pl"));
    const input = screen.getByLabelText("Amount");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1 234,5" } });
    expect(onValue).toHaveBeenLastCalledWith(1234.5);
    fireEvent.change(input, { target: { value: "" } });
    expect(onValue).toHaveBeenLastCalledWith(null);
  });

  it("ignores letters, and a minus gives null unless allowNegative", () => {
    const onValue = vi.fn();
    render(inLocale(<Harness onValue={onValue} />));
    const input = screen.getByLabelText("Amount");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12a" } });
    expect(onValue).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "-5" } });
    expect(onValue).toHaveBeenLastCalledWith(null);
    cleanup();

    const onSigned = vi.fn();
    render(inLocale(<Harness onValue={onSigned} allowNegative />));
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "-5" } });
    expect(onSigned).toHaveBeenLastCalledWith(-5);
  });

  it("uses the decimal keypad", () => {
    render(inLocale(<Harness />));
    expect(screen.getByLabelText("Amount").getAttribute("inputmode")).toBe("decimal");
  });
});

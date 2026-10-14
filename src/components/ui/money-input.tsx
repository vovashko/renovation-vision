"use client";

import * as React from "react";

import { DEFAULT_CURRENCY, parseMoney, type Currency } from "@/domain/money";
import { useLocale } from "@/i18n/hooks";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";

type MoneyInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode"> & {
  /** The amount, or null when empty. */
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  /** Project currency shown in the addon. */
  currency?: Currency;
  /** Accept a minus sign (only a change request's cost change). */
  allowNegative?: boolean;
};

const isAmount = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * Money field on `InputGroup`: currency addon, value grouped per locale at rest ("100 000" pl,
 * "100,000" en), raw digits while focused. Emits a number (null when empty or unparseable), so
 * react-hook-form holds a number, not text.
 *
 *   <FormField ...>{(field) => <MoneyInput {...field} currency="PLN" />}</FormField>
 */
function MoneyInput({ value, onChange, onBlur, onFocus, currency = DEFAULT_CURRENCY, allowNegative = false, ...props }: MoneyInputProps) {
  const locale = useLocale();
  // The text being edited; null when not focused (the display then follows `value`).
  const [draft, setDraft] = React.useState<string | null>(null);
  const display = draft ?? (isAmount(value) ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value) : "");

  return (
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>{currency}</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        autoComplete="off"
        {...props}
        inputMode="decimal"
        value={display}
        onFocus={(e) => {
          setDraft(isAmount(value) ? new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 2 }).format(value) : "");
          onFocus?.(e);
        }}
        onChange={(e) => {
          const text = e.target.value;
          if (!/^[\d\s.,-]*$/.test(text)) return;
          setDraft(text);
          onChange(parseMoney(text, locale, { allowNegative }));
        }}
        onBlur={(e) => {
          setDraft(null);
          onBlur?.(e);
        }}
      />
    </InputGroup>
  );
}

export { MoneyInput };
export type { MoneyInputProps };

// Money formatting. Pure: callers pass the currency and the locale (UI code uses `useFormat().money`).

/** ISO 4217 code, e.g. "PLN", "EUR". */
export type Currency = string;

/**
 * Fallback until projects carry their own `currency` column (a later schema task). Callers that
 * know the project's currency pass it; everything else formats in this one.
 */
export const DEFAULT_CURRENCY: Currency = "PLN";

export type MoneyOptions = {
  /** Fraction digits: 2 (default) for amounts and totals, 0 for whole-unit summaries. */
  decimals?: 0 | 2;
};

/** `formatMoney(12345, "PLN", "pl")` → "12 345,00 zł"; `formatMoney(12345, "PLN", "en")` → "PLN 12,345.00". */
export function formatMoney(amount: number, currency: Currency | undefined, locale: string, opts: MoneyOptions = {}): string {
  const decimals = opts.decimals ?? 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency ?? DEFAULT_CURRENCY,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

// Money formatting. Pure: callers pass the currency and the locale (UI code uses `useFormat().money`).

/** ISO 4217 code, e.g. "PLN", "EUR". */
export type Currency = string;

/**
 * The fallback when no currency is passed. Project money (budget, spent, expenses) always passes the
 * project's own `projects.currency` (T30); this only covers callers with no project at hand.
 */
export const DEFAULT_CURRENCY: Currency = "PLN";

export type MoneyOptions = {
  /** Fraction digits: 2 (default) for amounts and totals, 0 for whole-unit summaries. */
  decimals?: 0 | 2;
  /** Always show the sign of a non-zero amount: "+1 000 zł", "-500 zł" (deviations). */
  signed?: boolean;
};

/** `formatMoney(12345, "PLN", "pl")` → "12 345,00 zł"; `formatMoney(12345, "PLN", "en")` → "PLN 12,345.00". */
export function formatMoney(amount: number, currency: Currency | undefined, locale: string, opts: MoneyOptions = {}): string {
  const decimals = opts.decimals ?? 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency ?? DEFAULT_CURRENCY,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    ...(opts.signed ? { signDisplay: "exceptZero" as const } : {}),
  }).format(amount);
}

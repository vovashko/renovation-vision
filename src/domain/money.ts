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

/** Spaces a keyboard, a paste or `Intl` may put between digit groups (space, no-break, narrow no-break). */
const SPACES = /[\s\u00a0\u202f]/g;

export type ParseMoneyOptions = {
  /** Accept a leading minus (a saving). Off by default. */
  allowNegative?: boolean;
};

/**
 * Typed text -> amount, or null when empty or not a number. Pure, rounded to cents.
 *
 * Accepts "12,50", "12.50", "1 000", "1 000,50" and (en) "1,000.50". With both separators the last
 * one is the decimal mark; a lone dot is always decimal; a lone comma is decimal except in en when
 * exactly three digits follow ("1,000" is 1000).
 */
export function parseMoney(text: string, locale: string, opts: ParseMoneyOptions = {}): number | null {
  let s = text.replace(SPACES, "");
  if (s === "") return null;
  const negative = s.startsWith("-");
  if (negative) {
    if (!opts.allowNegative) return null;
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let decimalAt = -1;
  if (lastDot >= 0 && lastComma >= 0) decimalAt = Math.max(lastDot, lastComma);
  else if (lastDot >= 0) decimalAt = (s.match(/\./g)?.length ?? 0) === 1 ? lastDot : -1;
  else if (lastComma >= 0) {
    const single = (s.match(/,/g)?.length ?? 0) === 1;
    const groupLike = locale.startsWith("en") && s.length - lastComma - 1 === 3;
    decimalAt = single && !groupLike ? lastComma : -1;
  }

  const whole = decimalAt >= 0 ? s.slice(0, decimalAt) : s;
  const fraction = decimalAt >= 0 ? s.slice(decimalAt + 1) : "";
  if (/[.,]/.test(fraction) || fraction.length > 2) return null;
  const digits = whole.replace(/[.,]/g, "");
  if (digits === "" && fraction === "") return null;
  // Group marks must be one kind, and never the decimal mark's kind.
  if (/\./.test(whole) && /,/.test(whole) && decimalAt < 0) return null;
  if (decimalAt >= 0 && whole.includes(s.charAt(decimalAt))) return null;

  const value = Number(`${digits || "0"}${fraction ? `.${fraction}` : ""}`);
  if (!Number.isFinite(value)) return null;
  const result = Math.round(value * 100) / 100;
  return negative && result !== 0 ? -result : result;
}

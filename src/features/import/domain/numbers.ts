// Number and date cells as people type them in spreadsheets. Pure.

/**
 * Parses "12,50", "12.50", "1 234,50", "1.234,50", "1,234.50" and "12" into a number; undefined when the text
 * isn't a number. The last separator is the decimal one when both appear; a lone comma is a decimal comma.
 */
export function parseDecimal(raw: string): number | undefined {
  const text = raw.replace(/\s/g, "");
  if (!/^[+-]?[\d.,]+$/.test(text) || !/\d/.test(text)) return undefined;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalAt = Math.max(lastComma, lastDot);
    normalized = text.slice(0, decimalAt).replace(/[.,]/g, "") + "." + text.slice(decimalAt + 1);
  } else if (lastComma >= 0 || lastDot >= 0) {
    const parts = text.split(lastComma >= 0 ? "," : ".");
    // "1,234,567" / "1.234.567": repeated separators can only be thousands separators.
    normalized = parts.length > 2 ? parts.join("") : `${parts[0]}.${parts[1]}`;
  } else {
    normalized = text;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const DAY_FIRST = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;

/** "2026-03-01", "01.03.2026", "1/3/2026" (day first, as in Poland) → "2026-03-01"; undefined for anything else or an impossible date. */
export function parseDateCell(raw: string): string | undefined {
  const text = raw.trim();
  let y: number, m: number, d: number;
  const iso = ISO.exec(text);
  const dmy = DAY_FIRST.exec(text);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dmy) [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  else return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

import { describe, it, expect } from "vitest";
import { DEFAULT_CURRENCY, formatMoney } from "@/domain/money";

// Intl separates groups and the currency with a no-break space (U+00A0) or a narrow no-break
// space (U+202F), depending on the ICU version. Compare with plain spaces.
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

describe("formatMoney", () => {
  it("formats PLN in Polish", () => {
    expect(plain(formatMoney(12345, "PLN", "pl"))).toBe("12 345,00 zł");
  });

  it("formats PLN in English", () => {
    expect(plain(formatMoney(12345, "PLN", "en"))).toBe("PLN 12,345.00");
  });

  it("formats EUR", () => {
    expect(plain(formatMoney(12345, "EUR", "pl"))).toBe("12 345,00 €");
    expect(plain(formatMoney(12345, "EUR", "en"))).toBe("€12,345.00");
  });

  it("formats zero", () => {
    expect(plain(formatMoney(0, "PLN", "pl"))).toBe("0,00 zł");
    expect(plain(formatMoney(0, "PLN", "en"))).toBe("PLN 0.00");
  });

  it("formats negative amounts", () => {
    expect(plain(formatMoney(-1234.5, "PLN", "pl"))).toBe("-1234,50 zł");
    expect(plain(formatMoney(-1234.5, "PLN", "en"))).toBe("-PLN 1,234.50");
  });

  it("rounds to two decimals", () => {
    expect(plain(formatMoney(99.999, "PLN", "pl"))).toBe("100,00 zł");
    expect(plain(formatMoney(10.004, "PLN", "en"))).toBe("PLN 10.00");
  });

  it("drops the decimals with { decimals: 0 }", () => {
    expect(plain(formatMoney(12345.6, "PLN", "pl", { decimals: 0 }))).toBe("12 346 zł");
    expect(plain(formatMoney(12345.6, "PLN", "en", { decimals: 0 }))).toBe("PLN 12,346");
  });

  it("falls back to DEFAULT_CURRENCY (PLN) when no currency is given", () => {
    expect(DEFAULT_CURRENCY).toBe("PLN");
    expect(plain(formatMoney(5, undefined, "pl"))).toBe("5,00 zł");
  });
});

describe("formatMoney signed", () => {
  it("shows the sign of a non-zero amount and none for zero", () => {
    expect(plain(formatMoney(12000, "PLN", "pl", { decimals: 0, signed: true }))).toBe("+12 000 zł");
    expect(plain(formatMoney(-500, "PLN", "pl", { decimals: 0, signed: true }))).toBe("-500 zł");
    expect(plain(formatMoney(0, "PLN", "pl", { decimals: 0, signed: true }))).toBe("0 zł");
  });
});

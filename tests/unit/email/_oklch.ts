// A pure OKLCH -> sRGB hex converter (Björn Ottosson's formulas), used only by
// design-tokens.test.ts to check src/server/email/design/tokens.ts against src/styles.css. Not a
// *.test.ts file on purpose: it isn't a test suite, just a helper the test imports.

function toSrgbByte(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear));
  const v = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(v * 255);
}

/** `oklchToRgb(0.374, 0.026, 151.4)` → `[55, 69, 58]` (≈ #37453A). */
export function oklchToRgb(L: number, C: number, hueDegrees: number): [number, number, number] {
  const hRad = (hueDegrees * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [toSrgbByte(rLin), toSrgbByte(gLin), toSrgbByte(bLin)];
}

export function oklchToHex(L: number, C: number, hueDegrees: number): string {
  return (
    "#" +
    oklchToRgb(L, C, hueDegrees)
      .map((n) => n.toString(16).padStart(2, "0").toUpperCase())
      .join("")
  );
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [parseInt(normalized.slice(0, 2), 16), parseInt(normalized.slice(2, 4), 16), parseInt(normalized.slice(4, 6), 16)];
}

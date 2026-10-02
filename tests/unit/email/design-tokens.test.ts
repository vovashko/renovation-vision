// Fails if src/server/email/design/tokens.ts drifts from src/styles.css: parses the light-mode
// `--m3-*` oklch values and `--radius-*` px values there, converts the colors to sRGB hex with the
// same formulas the browser uses, and compares (±1 per channel, to tolerate rounding) against the
// literal hex/px values the email design tokens hardcode (email clients can't read CSS variables).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emailColors, emailRadii } from "@/server/email/design/tokens";
import { hexToRgb, oklchToRgb } from "./_oklch";

const STYLES_PATH = path.resolve(__dirname, "../../../src/styles.css");
const styles = fs.readFileSync(STYLES_PATH, "utf8");

/** The first (light-mode) `--name: oklch(L C H);` match for each `--m3-*` var in styles.css. */
function parseOklchVars(css: string): Map<string, [number, number, number]> {
  const map = new Map<string, [number, number, number]>();
  const re = /(--m3-[\w-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\);/g;
  for (const match of css.matchAll(re)) {
    const [, name, l, c, h] = match;
    if (!map.has(name)) map.set(name, [Number(l), Number(c), Number(h)]);
  }
  return map;
}

/** Every `--radius-name: Npx;` in styles.css. */
function parseRadii(css: string): Map<string, number> {
  const map = new Map<string, number>();
  const re = /(--radius-[\w-]+):\s*(\d+)px;/g;
  for (const match of css.matchAll(re)) map.set(match[1], Number(match[2]));
  return map;
}

const oklchVars = parseOklchVars(styles);
const radiusVars = parseRadii(styles);

/** emailColors key -> the --m3-* var in styles.css it must mirror (light mode). */
const COLOR_SOURCE: Record<keyof typeof emailColors, string> = {
  primary: "--m3-primary",
  onPrimary: "--m3-on-primary",
  primaryContainer: "--m3-primary-container",
  onPrimaryContainer: "--m3-on-primary-container",
  background: "--m3-surface",
  surface: "--m3-surface-container-lowest",
  onSurface: "--m3-on-surface",
  onSurfaceVariant: "--m3-on-surface-variant",
  outlineVariant: "--m3-outline-variant",
};

/** emailRadii key -> the --radius-* var in styles.css it must mirror. */
const RADIUS_SOURCE: Record<keyof typeof emailRadii, string> = {
  button: "--radius-md",
  card: "--radius-xl",
};

describe("email design tokens vs. styles.css (drift guard)", () => {
  it("finds every expected --m3-* and --radius-* variable in styles.css (the parser itself isn't broken)", () => {
    for (const cssVar of Object.values(COLOR_SOURCE)) expect(oklchVars.has(cssVar), cssVar).toBe(true);
    for (const cssVar of Object.values(RADIUS_SOURCE)) expect(radiusVars.has(cssVar), cssVar).toBe(true);
  });

  describe.each(Object.entries(COLOR_SOURCE))("emailColors.%s", (tokenName, cssVar) => {
    it(`matches ${cssVar}'s oklch value (converted to sRGB, ±1 per channel)`, () => {
      const [l, c, h] = oklchVars.get(cssVar)!;
      const expectedRgb = oklchToRgb(l, c, h);
      const actualRgb = hexToRgb(emailColors[tokenName as keyof typeof emailColors]);
      for (let i = 0; i < 3; i++) {
        expect(Math.abs(actualRgb[i] - expectedRgb[i]), `${tokenName} channel ${i}`).toBeLessThanOrEqual(1);
      }
    });
  });

  describe.each(Object.entries(RADIUS_SOURCE))("emailRadii.%s", (tokenName, cssVar) => {
    it(`matches ${cssVar}'s px value exactly`, () => {
      expect(emailRadii[tokenName as keyof typeof emailRadii]).toBe(radiusVars.get(cssVar));
    });
  });
});

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Enforces the three layers described in README.md's "UI conventions" section: long Tailwind class
// strings and inline color/background/border styles belong in src/components/ui/* (the design
// system), not in feature code or routes; lucide-react is banned everywhere in favor of ui/icon.
// Plain fs + regex on purpose — no ts-morph/AST parsing — so this stays fast in `bun run test`.

const SRC_ROOT = path.resolve(__dirname, "../../../src");
const UI_DIR = path.join(SRC_ROOT, "components", "ui");
const ALLOWLIST_PATH = path.join(__dirname, "ui-layers.allowlist.json");
const README_POINTER = 'See README.md\'s "UI conventions" section (and tests/unit/arch/ui-layers.allowlist.json).';

type AllowlistEntry = { file: string; snippet: string; reason: string };

function listTsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === UI_DIR) continue; // the design system itself: long class strings live here
      listTsxFiles(full, out);
    } else if (entry.isFile() && full.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const files = listTsxFiles(SRC_ROOT);
const allowlist: AllowlistEntry[] = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf8"));

describe("ui-layers guard", () => {
  it("has no lucide-react imports outside components/ui", () => {
    const offenders = files
      .filter((f) => /from\s+["']lucide-react["']/.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(SRC_ROOT, f));

    expect(offenders, ["lucide-react is banned; use ui/icon (Material Symbols) instead.", README_POINTER].join(" ")).toEqual([]);
  });

  it("has no un-allowlisted 70+ char className literals outside components/ui", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(SRC_ROOT, file);
      const content = fs.readFileSync(file, "utf8");
      for (const match of content.matchAll(/className="([^"]{70,})"/g)) {
        const value = match[1];
        const allowed = allowlist.some((e) => e.file === rel && value.includes(e.snippet));
        if (!allowed) offenders.push(`${rel}: className="${value}"`);
      }
    }

    expect(
      offenders,
      [
        "Long Tailwind class strings belong in a components/ui primitive or variant, not feature code.",
        "Either move the styling into one, or add a one-line reason to tests/unit/arch/ui-layers.allowlist.json.",
        README_POINTER,
        "",
        ...offenders,
      ].join("\n"),
    ).toEqual([]);
  });

  it("has no inline color, background or border styles outside components/ui", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(SRC_ROOT, file);
      const content = fs.readFileSync(file, "utf8");
      for (const match of content.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
        const body = match[1];
        if (/\b(color|background\w*|border\w*)\s*:/i.test(body)) offenders.push(`${rel}: style={{${body.trim()}}}`);
      }
    }

    expect(
      offenders,
      [
        "Color, background and border values belong in a Tailwind class (a design token) applied via a",
        "components/ui primitive or variant, not an inline style.",
        README_POINTER,
        "",
        ...offenders,
      ].join("\n"),
    ).toEqual([]);
  });

  it("every allowlist entry still matches something (no stale entries)", () => {
    const stale = allowlist.filter((e) => {
      const full = path.join(SRC_ROOT, e.file);
      if (!fs.existsSync(full)) return true;
      const content = fs.readFileSync(full, "utf8");
      return ![...content.matchAll(/className="([^"]{70,})"/g)].some((m) => m[1].includes(e.snippet));
    });

    expect(stale, `Stale ui-layers.allowlist.json entries (file gone, or the class string changed): ${JSON.stringify(stale)}`).toEqual([]);
  });
});

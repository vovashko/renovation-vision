import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { LOCALES } from "@/i18n/locale";
import { namespaceFiles, namespaces } from "@/i18n/resources";

// Every namespace must have the same keys in every locale, with the same {{placeholders}}, so a
// missing Polish string fails CI instead of silently falling back to English. Plural forms differ
// by language (en: _one/_other, pl: _one/_few/_many/_other), so they are compared by base key.

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Flattened "a.b.c" → string value. */
function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(out, flatten(value as Record<string, unknown>, full));
    else out[full] = String(value);
  }
  return out;
}

/** Base key → sorted placeholder names, merging a key's plural forms. */
function placeholdersByBaseKey(obj: Record<string, unknown>): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const [key, value] of Object.entries(flatten(obj))) {
    const base = key.replace(PLURAL_SUFFIX, "");
    const set = map.get(base) ?? new Set<string>();
    for (const m of value.matchAll(/\{\{\s*([\w.]+)[^}]*\}\}/g)) set.add(m[1]);
    map.set(base, set);
  }
  return new Map([...map].map(([k, v]) => [k, [...v].sort()]));
}

const fileFor = (ns: string, locale: string) => namespaceFiles.find((f) => f.ns === ns && f.locale === locale);

describe("i18n resources", () => {
  it("finds the common namespace and every feature namespace", () => {
    expect(namespaces[0]).toBe("common");
    expect(namespaces).toEqual(
      expect.arrayContaining([
        "projects",
        "work",
        "media",
        "budget",
        "comms",
        "people",
        "knowledge",
        "auth",
        "settings",
        "admin",
        "import",
      ]),
    );
  });

  it("has only supported locales", () => {
    for (const f of namespaceFiles) expect(LOCALES, `${f.path}: unsupported locale "${f.locale}"`).toContain(f.locale);
  });

  it("declares every namespace in i18next.d.ts (typed keys)", () => {
    const dts = fs.readFileSync(path.resolve(__dirname, "../../../src/i18n/i18next.d.ts"), "utf8");
    for (const ns of namespaces) expect(dts, `add "${ns}: typeof …" to src/i18n/i18next.d.ts`).toMatch(new RegExp(`\\n\\s+${ns}: typeof `));
  });

  describe.each(namespaces)("namespace %s", (ns) => {
    it("exists in every locale", () => {
      for (const locale of LOCALES) expect(fileFor(ns, locale), `missing ${locale}.json for "${ns}"`).toBeDefined();
    });

    it("has the same keys in every locale", () => {
      const [first, ...rest] = LOCALES.map((locale) => ({
        locale,
        keys: [...placeholdersByBaseKey(fileFor(ns, locale)?.data ?? {}).keys()].sort(),
      }));
      for (const other of rest) expect(other.keys, `${ns}: ${other.locale} vs ${first.locale}`).toEqual(first.keys);
    });

    it("uses the same {{placeholders}} for each key in every locale", () => {
      const [first, ...rest] = LOCALES.map((locale) => ({ locale, map: placeholdersByBaseKey(fileFor(ns, locale)?.data ?? {}) }));
      for (const other of rest) {
        for (const [key, placeholders] of first.map) {
          expect(other.map.get(key), `${ns}:${key} placeholders in ${other.locale} vs ${first.locale}`).toEqual(placeholders);
        }
      }
    });

    it("has no empty strings", () => {
      for (const locale of LOCALES) {
        const empty = Object.entries(flatten(fileFor(ns, locale)?.data ?? {})).filter(([, v]) => !v.trim());
        expect(
          empty.map(([k]) => k),
          `${ns} ${locale}`,
        ).toEqual([]);
      }
    });
  });
});

describe("parity checker", () => {
  it("compares plural forms by base key and nested keys by path", () => {
    const en = placeholdersByBaseKey({ a: { b: "x {{n}}" }, late_one: "{{count}} day", late_other: "{{count}} days" });
    const pl = placeholdersByBaseKey({
      a: { b: "y {{n}}" },
      late_one: "{{count}} dzień",
      late_few: "{{count}} dni",
      late_many: "{{count}} dni",
    });
    expect([...en.keys()].sort()).toEqual([...pl.keys()].sort());
    expect(en.get("a.b")).toEqual(["n"]);
    expect(pl.get("late")).toEqual(["count"]);
  });

  it("notices a missing nested key or a renamed placeholder", () => {
    const en = placeholdersByBaseKey({ a: { b: "{{name}}", c: "x" } });
    const pl = placeholdersByBaseKey({ a: { b: "{{imie}}" } });
    expect([...pl.keys()]).not.toEqual([...en.keys()]);
    expect(pl.get("a.b")).not.toEqual(en.get("a.b"));
  });
});

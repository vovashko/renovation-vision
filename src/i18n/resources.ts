import type { Resource, ResourceLanguage } from "i18next";
import { LOCALES, type Locale } from "./locale";

// Namespace registry. Every `src/features/<feature>/i18n/{en,pl}.json` is picked up automatically
// as the `<feature>` namespace, plus `src/i18n/common/{en,pl}.json` as `common` — so adding a
// namespace never touches this file (only `i18next.d.ts`, for typed keys). Bundled, not lazy-loaded:
// the JSON is small and SSR needs every string synchronously.

const featureFiles = import.meta.glob<Record<string, unknown>>("../features/*/i18n/*.json", { eager: true, import: "default" });
const commonFiles = import.meta.glob<Record<string, unknown>>("./common/*.json", { eager: true, import: "default" });

const FEATURE_PATH = /\/features\/([^/]+)\/i18n\/([^/]+)\.json$/;
const COMMON_PATH = /\/common\/([^/]+)\.json$/;

/** One JSON file: its namespace, locale and parsed content. */
export type NamespaceFile = { ns: string; locale: string; path: string; data: Record<string, unknown> };

/** Every namespace file found on disk, including any for a locale we don't support (the parity test flags those). */
export const namespaceFiles: NamespaceFile[] = [
  ...Object.entries(commonFiles).map(([path, data]) => ({ ns: "common", locale: COMMON_PATH.exec(path)![1], path, data })),
  ...Object.entries(featureFiles).map(([path, data]) => {
    const [, ns, locale] = FEATURE_PATH.exec(path)!;
    return { ns, locale, path, data };
  }),
];

/** Namespace names, `common` first. */
export const namespaces: string[] = [...new Set(namespaceFiles.map((f) => f.ns))];

/** i18next `resources`: `{ [locale]: { [namespace]: json } }`. */
export const resources: Resource = Object.fromEntries(
  LOCALES.map((locale: Locale) => [
    locale,
    Object.fromEntries(namespaceFiles.filter((f) => f.locale === locale).map((f) => [f.ns, f.data])) as ResourceLanguage,
  ]),
);

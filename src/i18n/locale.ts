// Locale vocabulary and resolution. Pure (no i18next, no React): the server resolves a request's
// locale with `resolveLocale`, and tests call it directly.

export const LOCALES = ["pl", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Used when nothing else says which language to show. */
export const DEFAULT_LOCALE: Locale = "pl";

/** Cookie holding the user's explicit choice (set by the language switch on /settings). */
export const LOCALE_COOKIE = "locale";

const ONE_YEAR_S = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** A supported locale for a BCP 47 tag: "en-GB" → "en", "PL" → "pl", "de" → undefined. */
export function matchLocale(tag: string | null | undefined): Locale | undefined {
  const base = tag?.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : undefined;
}

/** The best supported locale in an `Accept-Language` header, honoring q-weights ("de, en;q=0.8" → "en"). */
export function parseAcceptLanguage(header: string | null | undefined): Locale | undefined {
  if (!header) return undefined;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag, q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter((entry) => entry.tag && !Number.isNaN(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of ranked) {
    const locale = matchLocale(tag);
    if (locale) return locale;
  }
  return undefined;
}

/** One cookie's value from a `Cookie` header (or `document.cookie`). */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export type LocaleSources = {
  /**
   * The signed-in user's saved preference (`profiles.locale`, added by a later schema task).
   * Checked first once it exists; until then callers leave it out.
   */
  profile?: string | null;
  /** The `locale` cookie's value. */
  cookie?: string | null;
  /** The request's `Accept-Language` header. */
  acceptLanguage?: string | null;
};

/** Resolution order: profile → cookie → Accept-Language → `DEFAULT_LOCALE` (pl). Unsupported values are skipped. */
export function resolveLocale(sources: LocaleSources): Locale {
  return matchLocale(sources.profile) ?? matchLocale(sources.cookie) ?? parseAcceptLanguage(sources.acceptLanguage) ?? DEFAULT_LOCALE;
}

/** The `Set-Cookie`/`document.cookie` string that remembers a locale for a year. */
export function localeCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${ONE_YEAR_S}; SameSite=Lax`;
}

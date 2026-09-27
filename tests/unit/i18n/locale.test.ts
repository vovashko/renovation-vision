import { describe, it, expect } from "vitest";
import { DEFAULT_LOCALE, localeCookie, matchLocale, parseAcceptLanguage, readCookie, resolveLocale } from "@/i18n/locale";
import { createI18n } from "@/i18n/instance";

describe("resolveLocale", () => {
  it("defaults to pl when nothing is known", () => {
    expect(DEFAULT_LOCALE).toBe("pl");
    expect(resolveLocale({})).toBe("pl");
  });

  it("uses Accept-Language when there is no cookie", () => {
    expect(resolveLocale({ acceptLanguage: "en-US,en;q=0.9" })).toBe("en");
    expect(resolveLocale({ acceptLanguage: "pl-PL,pl;q=0.9,en;q=0.8" })).toBe("pl");
  });

  it("prefers the cookie over Accept-Language", () => {
    expect(resolveLocale({ cookie: "pl", acceptLanguage: "en-US" })).toBe("pl");
    expect(resolveLocale({ cookie: "en", acceptLanguage: "pl" })).toBe("en");
  });

  it("puts a saved profile preference first (profiles.locale, later)", () => {
    expect(resolveLocale({ profile: "en", cookie: "pl", acceptLanguage: "pl" })).toBe("en");
    expect(resolveLocale({ profile: null, cookie: "en" })).toBe("en");
  });

  it("skips unsupported values and falls through to the next source", () => {
    expect(resolveLocale({ cookie: "fr", acceptLanguage: "en" })).toBe("en");
    expect(resolveLocale({ cookie: "de", acceptLanguage: "de-DE,fr;q=0.8" })).toBe("pl");
    expect(resolveLocale({ cookie: "", acceptLanguage: "" })).toBe("pl");
  });
});

describe("parseAcceptLanguage", () => {
  it("honors q-weights, not just order", () => {
    expect(parseAcceptLanguage("de, en;q=0.5, pl;q=0.8")).toBe("pl");
    expect(parseAcceptLanguage("de, en;q=0.8")).toBe("en");
  });

  it("matches regional variants and ignores q=0", () => {
    expect(parseAcceptLanguage("en-GB")).toBe("en");
    expect(parseAcceptLanguage("en;q=0, pl;q=0.1")).toBe("pl");
    expect(parseAcceptLanguage("*")).toBeUndefined();
    expect(parseAcceptLanguage(undefined)).toBeUndefined();
  });
});

describe("cookie helpers", () => {
  it("reads the locale cookie out of a Cookie header", () => {
    expect(readCookie("a=1; locale=en; b=2", "locale")).toBe("en");
    expect(readCookie("a=1", "locale")).toBeUndefined();
    expect(matchLocale(readCookie("locale=PL", "locale"))).toBe("pl");
  });

  it("writes a year-long, site-wide cookie", () => {
    expect(localeCookie("en")).toMatch(/^locale=en; Path=\/; Max-Age=31536000; SameSite=Lax$/);
  });
});

describe("createI18n (one instance per request)", () => {
  it("starts in the requested locale and translates synchronously", () => {
    expect(createI18n("pl").t("common:status.done")).toBe("Ukończone");
    expect(createI18n("en").t("common:status.done")).toBe("Completed");
    expect(createI18n().language).toBe("pl");
  });

  it("does not leak a language change between two requests", async () => {
    const requestA = createI18n("pl");
    const requestB = createI18n("pl");
    await requestA.changeLanguage("en");
    expect(requestA.t("common:nav.settings")).toBe("Settings");
    expect(requestB.language).toBe("pl");
    expect(requestB.t("common:nav.settings")).toBe("Ustawienia");
  });

  it("pluralizes per language", () => {
    const pl = createI18n("pl");
    expect(pl.t("common:attention.daysLate", { count: 1 })).toBe("1 dzień opóźnienia");
    expect(pl.t("common:attention.daysLate", { count: 3 })).toBe("3 dni opóźnienia");
    expect(pl.t("common:attention.daysLate", { count: 5 })).toBe("5 dni opóźnienia");
    const en = createI18n("en");
    expect(en.t("common:attention.daysLate", { count: 1 })).toBe("1 day late");
    expect(en.t("common:attention.daysLate", { count: 3 })).toBe("3 days late");
  });
});

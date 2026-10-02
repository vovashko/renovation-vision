import { beforeEach, describe, expect, it, vi } from "vitest";

// The request's cookie and Accept-Language header are stubbed; vitest runs createIsomorphicFn's
// server implementation (no Start compiler), which is what a hard page load uses.
const h = vi.hoisted(() => ({ cookie: undefined as string | undefined, acceptLanguage: undefined as string | undefined }));
vi.mock("@tanstack/react-start/server", () => ({
  getCookie: (name: string) => (name === "locale" ? h.cookie : undefined),
  getRequestHeader: (name: string) => (name === "accept-language" ? h.acceptLanguage : undefined),
}));

const { applyRequestLocale, signInLocale } = await import("@/i18n/request-locale");
const { createI18n } = await import("@/i18n/instance");

const USER = "a0000000-0000-4000-8000-000000000002";

async function localeFor(profileLocale: string | null | undefined) {
  const i18n = createI18n("pl");
  await applyRequestLocale(i18n, { userId: profileLocale === undefined ? null : USER, profileLocale });
  return i18n.language;
}

beforeEach(() => {
  h.cookie = undefined;
  h.acceptLanguage = undefined;
});

describe("applyRequestLocale (server): profiles.locale → cookie → Accept-Language → pl", () => {
  it("renders a signed-in user in their saved language, over the cookie and the header", async () => {
    h.cookie = "pl";
    h.acceptLanguage = "pl-PL";
    expect(await localeFor("en")).toBe("en");
  });

  it("uses the saved language with no cookie at all (a cleared cookie, another device)", async () => {
    h.acceptLanguage = "pl";
    expect(await localeFor("en")).toBe("en");
    expect(await localeFor("pl")).toBe("pl");
  });

  it("falls back to the cookie when signed out", async () => {
    h.cookie = "en";
    h.acceptLanguage = "pl";
    expect(await localeFor(undefined)).toBe("en");
  });

  it("then Accept-Language, then pl", async () => {
    h.acceptLanguage = "en-GB,en;q=0.9";
    expect(await localeFor(undefined)).toBe("en");
    h.acceptLanguage = "de-DE";
    expect(await localeFor(undefined)).toBe("pl");
  });

  it("skips an unsupported profile value", async () => {
    h.cookie = "en";
    expect(await localeFor("de")).toBe("en");
  });
});

describe("signInLocale (browser)", () => {
  it("switches to the saved language when a different user signs in", () => {
    expect(signInLocale(null, { userId: USER, profileLocale: "en" })).toBe("en");
    expect(signInLocale("someone-else", { userId: USER, profileLocale: "pl" })).toBe("pl");
  });

  it("leaves the language alone on the first navigation after hydration, for the same user, and when signed out", () => {
    expect(signInLocale(undefined, { userId: USER, profileLocale: "en" })).toBeUndefined();
    expect(signInLocale(USER, { userId: USER, profileLocale: "en" })).toBeUndefined();
    expect(signInLocale(USER, { userId: null })).toBeUndefined();
  });
});

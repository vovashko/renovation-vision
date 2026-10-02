import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import type { I18n } from "./instance";
import { LOCALE_COOKIE, matchLocale, resolveLocale, type Locale } from "./locale";

/** Who the request belongs to, as far as the language goes: the signed-in user and their saved `profiles.locale`. */
export type LocaleUser = { userId: string | null; profileLocale?: string | null };

/**
 * The locale for the current request, on the server: the signed-in user's `profiles.locale` → the
 * `locale` cookie → Accept-Language → pl. In the browser it returns undefined: the client's language
 * comes from the server via router hydration, and later changes come from the language switch or
 * a sign-in (see applyRequestLocale).
 */
const getRequestLocale = createIsomorphicFn()
  .server((profileLocale: string | null | undefined): Locale | undefined =>
    resolveLocale({ profile: profileLocale, cookie: getCookie(LOCALE_COOKIE), acceptLanguage: getRequestHeader("accept-language") }),
  )
  .client((_profileLocale: string | null | undefined): Locale | undefined => undefined);

// Browser only: the user whose saved language was last applied to each i18n instance.
const appliedUser = new WeakMap<I18n, string | null>();

/**
 * Browser: records who the server rendered the page for (router hydration), so the first sign-in
 * after it switches to that user's saved language.
 */
export function rememberLocaleUser(i18n: I18n, userId: string | null): void {
  appliedUser.set(i18n, userId);
}

/**
 * Browser: the language to switch to on a navigation, given the user seen on the previous one
 * (or the one the server rendered for, see rememberLocaleUser; `undefined` when unknown). Only a
 * newly signed-in user's saved language; otherwise none.
 */
export function signInLocale(previousUserId: string | null | undefined, user: LocaleUser): Locale | undefined {
  // Unknown previous user: the page was rendered for this session already, in the right language.
  if (previousUserId === undefined || !user.userId || previousUserId === user.userId) return undefined;
  return matchLocale(user.profileLocale);
}

/**
 * Root `beforeLoad`: point this request's i18n instance at the request's locale.
 *
 * - Server: the full resolution above, profile first, so a hard load renders in the saved language
 *   even without the cookie.
 * - Browser: only when a different user is now signed in (a sign-in without a reload), switch to
 *   their saved language. Otherwise leave the language alone: it already came from the server, and
 *   the language switch changes it in place (the cached session may lag behind it).
 */
export async function applyRequestLocale(i18n: I18n, user: LocaleUser): Promise<void> {
  let locale = getRequestLocale(user.profileLocale);
  if (locale === undefined && typeof document !== "undefined") {
    locale = signInLocale(appliedUser.get(i18n), user);
    appliedUser.set(i18n, user.userId);
  }
  if (locale && i18n.language !== locale) await i18n.changeLanguage(locale);
}

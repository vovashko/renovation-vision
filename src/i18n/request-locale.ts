import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import type { I18n } from "./instance";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./locale";

/**
 * The locale for the current request, on the server (cookie → Accept-Language → pl). In the
 * browser it returns undefined: the client's language comes from the server via router
 * hydration, and later changes only come from the language switch.
 *
 * TODO(profiles.locale): once the column exists, pass the signed-in user's value as `profile`.
 */
const getRequestLocale = createIsomorphicFn()
  .server((): Locale | undefined =>
    resolveLocale({ cookie: getCookie(LOCALE_COOKIE), acceptLanguage: getRequestHeader("accept-language") }),
  )
  .client((): Locale | undefined => undefined);

/** Root `beforeLoad`: point this request's i18n instance at the request's locale (server only). */
export async function applyRequestLocale(i18n: I18n): Promise<void> {
  const locale = getRequestLocale();
  if (locale && i18n.language !== locale) await i18n.changeLanguage(locale);
}

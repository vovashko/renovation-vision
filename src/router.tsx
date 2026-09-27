import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createI18n } from "@/i18n";
import { isLocale } from "@/i18n/locale";
import { routeTree } from "./routeTree.gen";

// Called once per request on the server and once in the browser, so everything created here
// (the query cache, the i18n instance) is per request and never shared across requests.
export const getRouter = () => {
  const queryClient = new QueryClient();
  const i18n = createI18n();

  const router = createRouter({
    routeTree,
    context: { queryClient, i18n },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // The root route's beforeLoad resolves the request's locale on the server; hand it to the
    // browser's instance before hydration so the first client render matches the SSR HTML.
    dehydrate: () => ({ locale: i18n.language }),
    hydrate: async ({ locale }) => {
      if (isLocale(locale) && i18n.language !== locale) await i18n.changeLanguage(locale);
    },
  });

  return router;
};

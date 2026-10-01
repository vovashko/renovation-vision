import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createI18n } from "@/i18n";
import { isLocale } from "@/i18n/locale";
import { createSessionStore, type Session } from "@/lib/auth";
import { routeTree } from "./routeTree.gen";

// Called once per request on the server and once in the browser, so everything created here
// (the query cache, the i18n instance, the session holder) is per request and never shared.
export const getRouter = () => {
  const queryClient = new QueryClient();
  const i18n = createI18n();
  const session = createSessionStore();

  const router = createRouter({
    routeTree,
    context: { queryClient, i18n, session },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // The server resolves the locale, the session (root beforeLoad) and whatever the guards cached
    // (the project layout's access + project summary). The browser starts from the same values, so
    // the first client render matches the SSR HTML and nothing is fetched twice. Query data is
    // plain JSON from Supabase, so the cache travels as a JSON string.
    dehydrate: () => ({
      locale: i18n.language,
      session: session.get() ?? null,
      queries: JSON.stringify(dehydrate(queryClient, { shouldDehydrateMutation: () => false })),
    }),
    hydrate: async ({ locale, session: auth, queries }: { locale: string; session: Session | null; queries: string }) => {
      if (auth) session.set(auth);
      if (queries) hydrate(queryClient, JSON.parse(queries));
      if (isLocale(locale) && i18n.language !== locale) await i18n.changeLanguage(locale);
    },
  });

  return router;
};

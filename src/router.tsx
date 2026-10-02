import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createI18n } from "@/i18n";
import { isLocale } from "@/i18n/locale";
import { createSessionStore, type Session } from "@/lib/auth";
import { getCspNonce } from "@/lib/csp-nonce";
import { initBrowserSentry, setSentryUser } from "@/lib/sentry-client";
import { routeTree } from "./routeTree.gen";

// Called once per request on the server and once in the browser, so everything created here
// (the query cache, the i18n instance, the session holder) is per request and never shared.
export const getRouter = () => {
  // getRouter() runs on the server (SSR) and in the browser (hydration). initBrowserSentry is
  // `createClientOnlyFn` (see src/lib/sentry-client.ts): the Start compiler compiles it to a
  // function that *throws* if ever called server-side (a safety net, not a silent no-op), so this
  // guard — not the compiler — is what keeps SSR from calling it. A no-op in the browser too,
  // without VITE_SENTRY_DSN.
  if (typeof document !== "undefined") initBrowserSentry();

  const queryClient = new QueryClient();
  const i18n = createI18n();
  const session = createSessionStore();

  const router = createRouter({
    routeTree,
    context: { queryClient, i18n, session },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // T26: the per-request CSP script nonce (src/server/middleware/security-headers.ts generates
    // it; src/lib/csp-nonce.ts hands it back here). TanStack Start stamps it onto its own inline
    // hydration scripts; undefined in the browser, where it isn't needed (see csp-nonce.ts).
    ssr: { nonce: getCspNonce() },
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
      setSentryUser(auth?.user?.id);
      if (queries) hydrate(queryClient, JSON.parse(queries));
      if (isLocale(locale) && i18n.language !== locale) await i18n.changeLanguage(locale);
    },
  });

  return router;
};

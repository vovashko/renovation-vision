import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider, useTranslation } from "react-i18next";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { buttonVariants } from "@/components/ui/button";
import { AuthSync, type SessionStore } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { I18n } from "@/i18n";
import { applyRequestLocale } from "@/i18n/request-locale";
import { ConfirmProvider } from "@/shared/ui/confirm-dialog";

import appCss from "../styles.css?url";
import logoMark from "@/assets/renovision-mark.svg";

function NotFoundComponent() {
  const { t } = useTranslation(["common"]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center">
        <h1 className="text-display text-on-surface">404</h1>
        <h2 className="mt-4 text-title-lg text-on-surface">{t("common:notFound.heading")}</h2>
        <p className="mt-2 text-body-md text-on-surface-variant">{t("common:notFound.description")}</p>
        <div className="mt-6">
          <Link to="/" className={buttonVariants()}>
            {t("common:notFound.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t } = useTranslation(["common"]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center">
        <h1 className="text-title-lg text-on-surface">{t("common:errorBoundary.heading")}</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">{error instanceof Error ? error.message : String(error)}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className={cn(buttonVariants(), "mt-6")}
        >
          {t("common:errorBoundary.retry")}
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient; i18n: I18n; session: SessionStore }>()({
  // Server: switch this request's i18n instance to the request's locale before rendering. Then put
  // the session in the context as `auth` (README → Sessions & route guards): on the server it comes
  // from the request's cookies (getSession); in the browser from the cached copy the server
  // dehydrated, or from getSession again after AuthSync saw the user change.
  beforeLoad: async ({ context }) => {
    await applyRequestLocale(context.i18n);
    return { auth: await context.session.load() };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "RenoVision" },
      {
        name: "description",
        content: "Track a home renovation: stages, plan, photos and chat with your site manager. Site managers update it all in one place.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,300..400,0..1,0&display=block",
      },
      { rel: "icon", type: "image/svg+xml", href: logoMark },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  const { i18n } = Route.useRouteContext();
  return (
    <I18nextProvider i18n={i18n} defaultNS="common">
      <Document>{children}</Document>
    </I18nextProvider>
  );
}

/** `<html lang>` follows the current language, including after a switch on /settings. */
function Document({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  return (
    <html lang={i18n.language}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <TooltipProvider delayDuration={300}>
        <ConfirmProvider>
          <Outlet />
        </ConfirmProvider>
        <Toaster position="top-center" richColors={false} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

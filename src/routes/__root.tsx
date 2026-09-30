import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider, useTranslation } from "react-i18next";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useParams,
  useRouterState,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AppRail } from "@/shared/ui/app-rail";
import { BottomNav } from "@/shared/ui/bottom-nav";
import { QuickActions } from "@/shared/ui/quick-actions";
import { LoginScreen } from "@/components/login-screen";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useProject } from "@/features/projects/hooks";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/database.types";
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

export const Route = createRootRouteWithContext<{ queryClient: QueryClient; i18n: I18n }>()({
  // Server: switch this request's i18n instance to the request's locale before rendering.
  beforeLoad: ({ context }) => applyRequestLocale(context.i18n),
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
      <AuthProvider>
        <TooltipProvider delayDuration={300}>
          <ConfirmProvider>
            <AuthGate />
          </ConfirmProvider>
          <Toaster position="top-center" richColors={false} />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthGate() {
  const { status } = useAuth();
  const { t } = useTranslation(["common"]);
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-body-md text-on-surface-variant" role="status">
        {t("common:state.loading")}
      </div>
    );
  }
  if (status === "signed-out") return <LoginScreen />;
  return <Shell />;
}

/** Tinted panel as wide as the page content below it; scrolls with the page. `narrow` matches the
 * chat page's centered chat panel (`md:max-w-3xl` in routes/project/chat.tsx), instead of the
 * page-wide `max-w-7xl` every other route uses. */
function ProjectTopBar({ project, narrow }: { project?: ProjectSummary; narrow?: boolean }) {
  const { t } = useTranslation(["common"]);
  return (
    <header className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 md:px-8 md:pt-4">
      <Card variant="tinted" className={cn("mx-auto flex h-16 w-full items-center gap-3 px-5", narrow ? "max-w-3xl" : "max-w-7xl")}>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-title-md">{project?.name ?? "…"}</span>
          <span className="hidden truncate text-body-sm text-on-surface-variant md:block">{project?.address}</span>
          {project && (
            <div className="mt-1 flex items-center gap-2 md:hidden">
              <Progress value={project.overall_progress} onPanel aria-label={t("common:overallProgress")} className="flex-1" />
              <span className="text-label-sm text-on-surface-variant tabular-nums">{project.overall_progress}%</span>
            </div>
          )}
        </div>
      </Card>
    </header>
  );
}

function Shell() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const { data: project } = useProject(projectId);
  // The Overview has no top bar: its project card already shows the same information.
  const isOverview = !!projectId && path.replace(/\/$/, "") === `/projects/${projectId}`;
  // Top bar only inside a project, past the Overview. Projects list, Settings and Overview start at the top.
  const showTopBar = !!projectId && !isOverview;
  const isChat = !!projectId && path.replace(/\/$/, "") === `/projects/${projectId}/chat`;

  return (
    <div className="flex min-h-screen w-full bg-surface text-on-surface">
      <AppRail />
      <div className="flex min-w-0 flex-1 flex-col">
        {showTopBar && <ProjectTopBar project={project} narrow={isChat} />}
        <main
          className={cn(
            "min-w-0 flex-1 p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:px-8 md:pb-8",
            // Both roles now get the phone bottom bar (`bottom-nav.tsx`); `ui/tab-bar` is `md:hidden`,
            // so the extra bottom padding above only matters below md and md:pb-8 replaces it above.
            showTopBar ? "md:pt-6" : "pt-[max(calc(var(--spacing)*10),env(safe-area-inset-top))]",
          )}
        >
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <QuickActions />
    </div>
  );
}

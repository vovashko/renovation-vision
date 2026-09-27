import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { AppSidebar } from "@/components/app-sidebar";
import { MobileTabBar } from "@/components/mobile-nav";
import { LoginScreen } from "@/components/login-screen";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useProject } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/database.types";

import appCss from "../styles.css?url";
import logoMark from "@/assets/renovision-mark.svg";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center">
        <h1 className="text-display text-on-surface">404</h1>
        <h2 className="mt-4 text-title-lg text-on-surface">Page not found</h2>
        <p className="mt-2 text-body-md text-on-surface-variant">The page you're looking for doesn't exist or has been moved.</p>
        <div className="mt-6">
          <Link to="/" className={buttonVariants()}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center">
        <h1 className="text-title-lg text-on-surface">Something went wrong</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">{error instanceof Error ? error.message : String(error)}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className={cn(buttonVariants(), "mt-6")}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
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
  return (
    <html lang="en">
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
          <AuthGate />
          <Toaster position="top-center" richColors={false} />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthGate() {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-body-md text-on-surface-variant" role="status">
        Loading…
      </div>
    );
  }
  if (status === "signed-out") return <LoginScreen />;
  return <Shell />;
}

/** Tinted panel as wide as the page content below it; scrolls with the page. */
function ProjectTopBar({ project }: { project?: ProjectSummary }) {
  return (
    <header className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 md:px-8 md:pt-4">
      <Card variant="tinted" className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-5">
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-title-md">{project?.name ?? "…"}</span>
          <span className="hidden truncate text-body-sm text-on-surface-variant md:block">{project?.address}</span>
          {project && (
            <div className="mt-1 flex items-center gap-2 md:hidden">
              <Progress value={project.overall_progress} onPanel aria-label="Overall progress" className="flex-1" />
              <span className="text-label-sm text-on-surface-variant tabular-nums">{project.overall_progress}%</span>
            </div>
          )}
        </div>
      </Card>
    </header>
  );
}

function Shell() {
  const { profile } = useAuth();
  const isManager = profile?.account_type === "manager";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const { data: project } = useProject(projectId);
  // The Overview has no top bar: its project card already shows the same information.
  const isOverview = !!projectId && path.replace(/\/$/, "") === `/projects/${projectId}`;
  // Top bar only inside a project, past the Overview. Projects list, Settings and Overview start at the top.
  const showTopBar = !!projectId && !isOverview;

  return (
    <div className="flex min-h-screen w-full bg-surface text-on-surface">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {showTopBar && <ProjectTopBar project={project} />}
        <main
          className={cn(
            "min-w-0 flex-1 p-4 md:px-8 md:pb-8",
            // Clear the phone bottom bar (clients only — managers get a mobile nav in a later task).
            !isManager && "pb-[calc(6.5rem+env(safe-area-inset-bottom))]",
            showTopBar ? "md:pt-6" : "pt-[max(calc(var(--spacing)*10),env(safe-area-inset-top))]",
          )}
        >
          <Outlet />
        </main>
      </div>
      {!isManager && <MobileTabBar />}
    </div>
  );
}

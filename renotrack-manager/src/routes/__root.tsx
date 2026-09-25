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
import { Badge } from "@/components/ui/badge";
import { cardVariants } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar, MobileTabBar } from "@/components/app-sidebar";
import { ManagerBadge } from "@/components/manager-badge";
import { LoginScreen, NotAManagerScreen } from "@/components/login-screen";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useProject } from "@/lib/queries";

import appCss from "../styles.css?url";
import markUrl from "../assets/renovision-manager-mark.svg?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
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
      { title: "RenoTrack Manager" },
      { name: "description", content: "Admin portal for site managers: update the stages, plan, photos, budget and chat your clients see in RenoTrack." },
      { name: "robots", content: "noindex" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: markUrl },
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
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
        <Toaster position="top-center" richColors={false} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthGate() {
  const { status, profile } = useAuth();
  if (status === "loading") {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground" role="status">Loading…</div>;
  }
  if (status === "signed-out") return <LoginScreen />;
  if (profile?.account_type !== "manager") return <NotAManagerScreen />;
  return <Shell />;
}

function Shell() {
  const { isDemo } = useAuth();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const { data: project } = useProject(projectId);
  // The Overview has no top bar: its project card already shows the same information.
  const isOverview = !!projectId && path.replace(/\/$/, "") === `/projects/${projectId}`;
  const isChat = path.endsWith("/chat");
  // Top bar only inside a project (not on its Overview). Projects and Settings start at the top.
  const showTopBar = !!projectId && !isOverview;

  return (
    <div className="flex min-h-screen w-full bg-surface text-on-surface">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {showTopBar && (
          <header className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 md:px-8 md:pt-4">
            {/* Tinted panel as wide as the page content below it; scrolls with the page. */}
            <div
              className={cn(
                cardVariants({ variant: "tinted" }),
                "mx-auto flex h-16 w-full items-center gap-3 px-5",
                isChat ? "max-w-3xl" : "max-w-7xl",
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-title-md">{project?.name ?? "…"}</span>
                <span className="hidden truncate text-body-sm text-on-surface-variant md:block">
                  {project?.address}
                </span>
                {project && (
                  <div className="mt-1 flex items-center gap-2 md:hidden">
                    <Progress value={project.overall_progress} onPanel aria-label="Overall progress" className="flex-1" />
                    <span className="text-label-sm tabular-nums text-on-surface-variant">{project.overall_progress}%</span>
                  </div>
                )}
              </div>
              {isDemo && (
                <Badge variant="assist" size="compact" className="hidden lg:inline-flex" title="Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to connect">
                  Demo data
                </Badge>
              )}
              <ManagerBadge onPanel />
            </div>
          </header>
        )}
        <main
          className={cn(
            "min-w-0 flex-1 p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:px-8 md:pb-8",
            // Without the top bar, content starts level with the rail's top edge.
            showTopBar ? "md:pt-6" : "pt-[max(1rem,env(safe-area-inset-top))] md:pt-4",
          )}
        >
          <Outlet />
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileTabBar } from "@/components/mobile-nav";
import { PhotoProvider } from "@/lib/photo-store";
import { overallProgress, project } from "@/lib/renovation-data";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import appCss from "../styles.css?url";
import markUrl from "@/assets/renovision-mark.svg?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-display-lg text-on-surface">404</h1>
        <h2 className="mt-4 text-title-lg text-on-surface">Page not found</h2>
        <p className="mt-2 text-body-md text-on-surface-variant">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link to="/" className={buttonVariants()}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-title-lg text-on-surface">Something went wrong</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">{error.message}</p>
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
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { title: "RenoTrack — Renovation Progress" },
      {
        name: "description",
        content:
          "Track the live state of your home renovation: stages, plan, and chat with your manager.",
      },
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
      <PhotoProvider>
        <TooltipProvider delayDuration={300}>
          <div className="flex min-h-screen w-full bg-surface text-on-surface">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-30 border-b border-outline-variant bg-surface pt-[env(safe-area-inset-top)]">
                <div className="flex h-14 items-center gap-3 px-4">
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-title-md">{project.name}</span>
                    <span className="hidden text-body-sm text-on-surface-variant md:block">
                      {project.address}
                    </span>
                    <HeaderProgress className="md:hidden" />
                  </div>
                </div>
              </header>
              <main className="min-w-0 flex-1 p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:p-8">
                <Outlet />
              </main>
            </div>
          </div>
          <MobileTabBar />
        </TooltipProvider>
      </PhotoProvider>
    </QueryClientProvider>
  );
}

function HeaderProgress({ className = "" }: { className?: string }) {
  const progress = overallProgress();
  return (
    <div className={cn("mt-1 flex items-center gap-2", className)}>
      <Progress value={progress} aria-label="Overall progress" className="flex-1" />
      <span className="text-label-sm tabular-nums text-on-surface-variant">{progress}%</span>
    </div>
  );
}

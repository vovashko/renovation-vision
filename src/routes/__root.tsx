import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useParams,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/app-sidebar";
import { ManagerBadge } from "@/components/manager/manager-badge";
import { MobileTabBar } from "@/components/mobile-nav";
import { LoginScreen } from "@/components/login-screen";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useProject } from "@/lib/queries";

import appCss from "../styles.css?url";
import logoMark from "@/assets/renovision-mark.svg";

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
      { title: "RenoVision" },
      { name: "description", content: "Track a home renovation: stages, plan, photos and chat with your site manager. Site managers update it all in one place." },
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
  return <Shell />;
}

function Shell() {
  const { profile, isDemo, signOut, demoRole, switchDemoRole } = useAuth();
  const isManager = profile?.account_type === "manager";
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const { data: project } = useProject(projectId);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[image:var(--gradient-surface)]">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">{projectId ? project?.name ?? "…" : "All projects"}</span>
              <span className="truncate text-xs text-muted-foreground">{projectId ? project?.address : "Projects you manage"}</span>
            </div>
            {isManager && <ManagerBadge />}
            <div className="ml-auto flex items-center gap-2">
              {isDemo && (
                <div role="group" aria-label="Demo persona" className="flex rounded-full border p-0.5 text-xs">
                  {(["manager", "client"] as const).map((r) => (
                    <button key={r} onClick={() => switchDemoRole(r)} aria-pressed={demoRole === r} className={`rounded-full px-2.5 py-1 font-medium capitalize ${demoRole === r ? "bg-foreground text-background" : "text-muted-foreground"}`}>
                      {r}
                    </button>
                  ))}
                </div>
              )}
              {isDemo && (
                <span className="hidden rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground sm:inline" title="Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to connect">
                  Demo data — not connected
                </span>
              )}
              <span className="hidden text-sm text-muted-foreground md:inline">{profile?.full_name}</span>
              {!isDemo && (
                <button onClick={signOut} aria-label="Sign out" className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>
          </header>
          <main className={`flex-1 p-4 md:p-8 ${isManager ? "" : "pb-24 md:pb-8"}`}><Outlet /></main>
        </div>
      </div>
      {!isManager && <MobileTabBar />}
    </SidebarProvider>
  );
}

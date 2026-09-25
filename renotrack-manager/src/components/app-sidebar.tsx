import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { RenovisionLogo } from "@/components/renovision-logo";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const projectItems = [
  { title: "Overview", to: "/projects/$projectId", icon: "grid_view" },
  { title: "Stages", to: "/projects/$projectId/stages", icon: "checklist" },
  { title: "Plan", to: "/projects/$projectId/plan", icon: "floor" },
  { title: "Photos", to: "/projects/$projectId/photos", icon: "photo_camera" },
  { title: "Design", to: "/projects/$projectId/design", icon: "palette" },
  { title: "Budget", to: "/projects/$projectId/budget", icon: "account_balance_wallet" },
  { title: "Chat", to: "/projects/$projectId/chat", icon: "chat_bubble" },
  { title: "Updates", to: "/projects/$projectId/updates", icon: "notifications" },
  { title: "AI knowledge", to: "/projects/$projectId/knowledge", icon: "menu_book" },
  { title: "Team", to: "/projects/$projectId/team", icon: "group" },
] as const;

const itemClass = (active: boolean) =>
  cn(
    "flex h-14 w-full shrink-0 items-center whitespace-nowrap rounded-lg text-on-surface transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
    active ? "bg-surface-container-high" : "hover:bg-surface",
  );

/** Label fades in when the rail expands (always visible in the phone sheet). */
const labelClass = (expanded: boolean) =>
  cn(
    "pr-4 text-label-lg transition-opacity duration-150",
    expanded ? "opacity-100" : "opacity-0 group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100",
  );

function NavItems({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  return (
    <>
      <Link to="/" onClick={onNavigate} aria-label="Projects" aria-current={path === "/" ? "page" : undefined} className={itemClass(path === "/")}>
        <span className="grid w-14 shrink-0 place-items-center">
          <Icon name="folder_open" size={24} />
        </span>
        <span className={labelClass(expanded)}>Projects</span>
      </Link>
      {projectId &&
        projectItems.map((item) => {
          const active = path === item.to.replace("$projectId", projectId);
          return (
            <Link
              key={item.title}
              to={item.to}
              params={{ projectId }}
              onClick={onNavigate}
              aria-label={item.title}
              aria-current={active ? "page" : undefined}
              className={itemClass(active)}
            >
              <span className="grid w-14 shrink-0 place-items-center">
                <Icon name={item.icon} size={24} />
              </span>
              <span className={labelClass(expanded)}>{item.title}</span>
            </Link>
          );
        })}
    </>
  );
}

/** There is no settings page yet: Settings opens the account panel. */
function SettingsItem({ expanded }: { expanded: boolean }) {
  const { profile, email, isDemo, signOut } = useAuth();
  return (
    <Popover>
      <PopoverTrigger aria-label="Settings" className={itemClass(false)}>
        <span className="grid w-14 shrink-0 place-items-center">
          <Icon name="settings" size={24} />
        </span>
        <span className={labelClass(expanded)}>Settings</span>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-64">
        <div className="text-title-md">{profile?.full_name}</div>
        <div className="text-body-md text-on-surface-variant">{email}</div>
        {isDemo ? (
          <p className="mt-3 text-body-sm text-on-surface-variant">Demo data. Changes aren't saved and reset when you reload.</p>
        ) : (
          <Button variant="outline" onClick={signOut} className="mt-4 w-full">
            <Icon name="logout" size={20} />
            Sign out
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Navigation rail (768px and up): 96px, expands to 240px on hover or keyboard focus and
 * overlays the page. Labels and the wordmark fade in as it widens.
 */
export function AppSidebar() {
  return (
    <div className="relative hidden w-24 shrink-0 md:block">
      <div className="sticky top-3 z-30 h-[calc(100dvh-1.5rem)]">
        <nav
          aria-label="Main"
          className="group/rail absolute inset-y-0 left-0 z-20 flex w-24 flex-col overflow-hidden rounded-2xl border border-outline-variant bg-card px-5 py-5 transition-[width,box-shadow] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] hover:w-60 hover:shadow-float has-[:focus-visible]:w-60 has-[:focus-visible]:shadow-float"
        >
          <Link
            to="/"
            aria-label="RenoVision, all projects"
            className="mb-4 ml-2 block h-10 w-10 shrink-0 overflow-hidden rounded-md transition-[width] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] group-hover/rail:w-[151px] group-has-[:focus-visible]/rail:w-[151px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <RenovisionLogo className="h-10" />
          </Link>
          <div className="-mx-5 flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto px-5 [scrollbar-width:none]">
            <NavItems expanded={false} />
          </div>
          <div className="mt-2 shrink-0 border-t border-outline-variant pt-2">
            <SettingsItem expanded={false} />
          </div>
        </nav>
      </div>
    </div>
  );
}

/** Below 768px: a menu button in the header opens the same items in a sheet. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open navigation" className="text-on-surface md:hidden">
          <Icon name="menu" size={22} />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col gap-2 p-5">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <RenovisionLogo className="mb-4 ml-2 h-10 self-start" />
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          <NavItems expanded onNavigate={() => setOpen(false)} />
        </div>
        <div className="border-t border-outline-variant pt-2">
          <SettingsItem expanded />
        </div>
      </SheetContent>
    </Sheet>
  );
}

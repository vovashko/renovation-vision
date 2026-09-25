import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { RenovisionLogo } from "@/components/renovision-logo";
import { UserAvatar } from "@/components/user-avatar";
import { ProfileSheet } from "@/components/profile-form";
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

/** Settings: profile, photo, email and password (and sign out). */
function SettingsItem({ expanded }: { expanded: boolean }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const active = path === "/settings";
  return (
    <Link to="/settings" aria-label="Settings" aria-current={active ? "page" : undefined} className={itemClass(active)}>
      <span className="grid w-14 shrink-0 place-items-center">
        <Icon name="settings" size={24} />
      </span>
      <span className={labelClass(expanded)}>Settings</span>
    </Link>
  );
}

/** Your avatar and name, pinned at the bottom; opens the profile panel without leaving the page. */
function ProfileItem({ expanded }: { expanded: boolean }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const name = profile?.full_name ?? "";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${name || "Your profile"}, edit profile`}
        aria-haspopup="dialog"
        className={cn(itemClass(false), "cursor-pointer text-left")}
      >
        <span className="grid w-14 shrink-0 place-items-center">
          <UserAvatar name={name} src={profile?.avatar_url} />
        </span>
        <span className={cn(labelClass(expanded), "min-w-0 truncate")}>{name}</span>
      </button>
      <ProfileSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * Navigation rail (768px and up; phones use the bottom navigation bar). Sits in a fixed 96px
 * slot; the rail itself is absolutely positioned inside it, so expanding to 240px on hover or
 * keyboard focus overlays the page instead of pushing it. Labels and the wordmark fade in.
 */
export function AppSidebar() {
  return (
    <div className="sticky top-4 z-40 m-4 mr-0 hidden h-[calc(100dvh-2rem)] w-24 shrink-0 md:block">
      <nav
        aria-label="Main"
        className="group/rail absolute inset-y-0 left-0 z-20 flex w-24 flex-col overflow-hidden rounded-2xl border border-outline-variant bg-card px-5 py-5 transition-[width,box-shadow] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] hover:w-60 hover:shadow-float has-[:focus-visible]:w-60 has-[:focus-visible]:shadow-float motion-reduce:transition-none"
      >
        <Link
          to="/"
          aria-label="RenoVision Manager, all projects"
          className="mb-4 ml-2 block h-10 w-10 shrink-0 overflow-hidden rounded-md transition-[width] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] group-hover/rail:w-[158px] group-has-[:focus-visible]/rail:w-[158px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          <RenovisionLogo className="h-10" />
        </Link>
        <div className="-mx-5 flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto px-5 [scrollbar-width:none]">
          <NavItems expanded={false} />
          {/* Pushed to the bottom, just above the divider; scrolls with the list when it overflows. */}
          <div className="mt-auto">
            <SettingsItem expanded={false} />
          </div>
        </div>
        <div className="mt-2 shrink-0 border-t border-outline-variant pt-2">
          <ProfileItem expanded={false} />
        </div>
      </nav>
    </div>
  );
}

const tabs = [
  { title: "Overview", to: "/projects/$projectId", icon: "grid_view" },
  { title: "Stages", to: "/projects/$projectId/stages", icon: "checklist" },
  { title: "Photos", to: "/projects/$projectId/photos", icon: "photo_camera" },
  { title: "Chat", to: "/projects/$projectId/chat", icon: "chat_bubble" },
] as const;

// M3 navigation bar item: 64x32 indicator pill behind the icon, label below.
const tabClass = (active: boolean) =>
  cn(
    "group flex h-20 flex-1 flex-col items-center justify-center gap-1 text-label-md outline-none",
    active ? "text-on-surface" : "text-on-surface-variant",
  );
const pillClass = (active: boolean) =>
  cn(
    "state-layer flex h-8 w-16 items-center justify-center rounded-full group-focus-visible:outline-2 group-focus-visible:outline-primary",
    active && "bg-secondary-container text-on-secondary-container",
  );

/** Below 768px: M3 bottom navigation bar. "More" opens the other pages and the account. */
export function MobileTabBar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const tabHrefs = projectId ? tabs.map((t) => t.to.replace("$projectId", projectId)) : [];
  const moreItems = projectId ? projectItems.filter((i) => !tabs.some((t) => t.to === i.to)) : [];
  const moreActive = moreItems.some((i) => path === i.to.replace("$projectId", projectId ?? "")) || path === "/settings";
  const moreRow = (active: boolean) =>
    cn(
      "state-layer flex h-14 items-center gap-3 rounded-full pr-6 pl-4 text-label-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
      active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant",
    );

  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex bg-surface-container pb-[env(safe-area-inset-bottom)] md:hidden">
        {projectId ? (
          tabs.map((t, i) => {
            const active = path === tabHrefs[i];
            return (
              <Link key={t.title} to={t.to} params={{ projectId }} className={tabClass(active)} aria-current={active ? "page" : undefined}>
                <span className={pillClass(active)}>
                  <Icon name={t.icon} size={24} fill={active} />
                </span>
                {t.title}
              </Link>
            );
          })
        ) : (
          <Link to="/" className={tabClass(path === "/")} aria-current={path === "/" ? "page" : undefined}>
            <span className={pillClass(path === "/")}>
              <Icon name="folder_open" size={24} fill={path === "/"} />
            </span>
            Projects
          </Link>
        )}
        <button onClick={() => setOpen(true)} className={tabClass(moreActive)} aria-label="More pages" aria-haspopup="dialog">
          <span className={pillClass(moreActive)}>
            <Icon name="more_horiz" size={24} fill={moreActive} />
          </span>
          More
        </button>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-2 overflow-y-auto bg-surface-container-low px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SheetTitle className="px-4 pt-2 text-title-lg">More</SheetTitle>
          <div className="mt-2 grid gap-1 px-3">
            {projectId && (
              <Link to="/" onClick={() => setOpen(false)} className={moreRow(path === "/")}>
                <Icon name="folder_open" size={24} />
                All projects
              </Link>
            )}
            {moreItems.map((item) => {
              const active = path === item.to.replace("$projectId", projectId!);
              return (
                <Link key={item.title} to={item.to} params={{ projectId: projectId! }} onClick={() => setOpen(false)} className={moreRow(active)}>
                  <Icon name={item.icon} size={24} fill={active} />
                  {item.title}
                </Link>
              );
            })}
          </div>
          <div className="mx-1 mt-2 border-t border-outline-variant pt-2">
            <Link to="/settings" onClick={() => setOpen(false)} className={moreRow(path === "/settings")}>
              <Icon name="settings" size={24} fill={path === "/settings"} />
              Settings
            </Link>
            <ProfileRow
              onOpen={() => {
                setOpen(false);
                setProfileOpen(true);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

/** Phone "More" sheet: avatar + name row under Settings; opens the profile panel. */
function ProfileRow({ onOpen }: { onOpen: () => void }) {
  const { profile } = useAuth();
  const name = profile?.full_name ?? "";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${name || "Your profile"}, edit profile`}
      aria-haspopup="dialog"
      className="state-layer flex h-14 w-full items-center gap-3 rounded-full pr-6 pl-2.5 text-left text-label-lg text-on-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
    >
      <UserAvatar name={name} src={profile?.avatar_url} />
      <span className="min-w-0 truncate">{name}</span>
    </button>
  );
}

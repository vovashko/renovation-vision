import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/user-avatar";
import { ProfilePanel } from "@/components/profile-panel";
import { useAuth } from "@/lib/auth";
import { projectNav, projectPath } from "@/lib/nav";
import { cn } from "@/lib/utils";

const tabSections = ["", "stages", "photos", "chat"];
// TODO(later task): this bar is client-only for now (see __root.tsx); make it role-aware.
const clientNav = projectNav.filter((i) => !i.managerOnly);
const tabs = clientNav.filter((i) => tabSections.includes(i.section));
const more = clientNav.filter((i) => !tabSections.includes(i.section));

// M3 navigation bar item: a 64x32 active-indicator pill behind the icon, label below.
const tabClass = (active: boolean) =>
  cn(
    "group flex h-20 flex-1 flex-col items-center justify-center gap-1 text-label-md focus-visible:outline-none",
    active ? "text-on-surface" : "text-on-surface-variant",
  );
const pillClass = (active: boolean) =>
  cn(
    "state-layer flex h-8 w-16 items-center justify-center rounded-full group-focus-visible:outline-2 group-focus-visible:outline-primary",
    active && "bg-secondary-container text-on-secondary-container",
  );
const moreRowClass = (active: boolean) =>
  cn(
    "state-layer flex h-14 items-center gap-3 rounded-full pr-6 pl-4 text-label-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
    active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant",
  );

/** Client phone navigation (below md); managers keep the desktop nav rail. */
export function MobileTabBar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Outside a project (only reachable at /settings): a single row back to the project.
  if (!projectId) {
    return (
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex bg-surface-container pb-[env(safe-area-inset-bottom)] md:hidden">
        <Link to="/" className={tabClass(false)}>
          <span className={pillClass(false)}>
            <Icon name="arrow_back" size={24} />
          </span>
          Back
        </Link>
      </nav>
    );
  }

  const to = (section: string) => (section ? `/projects/$projectId/${section}` : "/projects/$projectId") as "/projects/$projectId";
  const moreActive = more.some((m) => projectPath(projectId, m.section) === path) || path === "/settings";
  const name = profile?.full_name ?? "";

  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex bg-surface-container pb-[env(safe-area-inset-bottom)] md:hidden">
        {tabs.map((t) => {
          const active = projectPath(projectId, t.section) === path;
          return (
            <Link
              key={t.section}
              to={to(t.section)}
              params={{ projectId }}
              className={tabClass(active)}
              aria-current={active ? "page" : undefined}
            >
              <span className={pillClass(active)}>
                <Icon name={t.icon} size={24} fill={active} />
              </span>
              {t.title}
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} className={tabClass(moreActive)} aria-label="More pages" aria-haspopup="dialog">
          <span className={pillClass(moreActive)}>
            <Icon name="more_horiz" size={24} fill={moreActive} />
          </span>
          More
        </button>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-2 overflow-y-auto bg-surface-container-low px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1 px-1">
            {more.map((m) => {
              const active = projectPath(projectId, m.section) === path;
              return (
                <Link
                  key={m.section}
                  to={to(m.section)}
                  params={{ projectId }}
                  onClick={() => setOpen(false)}
                  className={moreRowClass(active)}
                >
                  <Icon name={m.icon} size={24} fill={active} />
                  {m.title}
                </Link>
              );
            })}
          </div>
          <div className="mx-1 mt-2 border-t border-outline-variant pt-2">
            <Link to="/settings" onClick={() => setOpen(false)} className={moreRowClass(path === "/settings")}>
              <Icon name="settings" size={24} fill={path === "/settings"} />
              Settings
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setProfileOpen(true);
              }}
              aria-label={`${name || "Your profile"}, open profile`}
              aria-haspopup="dialog"
              className={cn(moreRowClass(false), "w-full text-left")}
            >
              <UserAvatar name={name} src={profile?.avatar_url} />
              <span className="min-w-0 truncate">{name}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
      <ProfilePanel open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

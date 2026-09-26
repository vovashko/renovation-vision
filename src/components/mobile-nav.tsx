import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/user-avatar";
import { ProfilePanel } from "@/components/profile-panel";
import { TabBar, TabBarItem, TabBarRow } from "@/shared/ui/tab-bar";
import { useAuth } from "@/lib/auth";
import { projectNav, projectPath } from "@/lib/nav";

const tabSections = ["", "stages", "photos", "chat"];
// TODO(later task): this bar is client-only for now (see __root.tsx); make it role-aware.
const clientNav = projectNav.filter((i) => !i.managerOnly);
const tabs = clientNav.filter((i) => tabSections.includes(i.section));
const more = clientNav.filter((i) => !tabSections.includes(i.section));

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
      <TabBar>
        <TabBarItem asChild icon="arrow_back" label="Back">
          <Link to="/" />
        </TabBarItem>
      </TabBar>
    );
  }

  const to = (section: string) => (section ? `/projects/$projectId/${section}` : "/projects/$projectId") as "/projects/$projectId";
  const moreActive = more.some((m) => projectPath(projectId, m.section) === path) || path === "/settings";
  const name = profile?.full_name ?? "";

  return (
    <>
      <TabBar>
        {tabs.map((t) => {
          const active = projectPath(projectId, t.section) === path;
          return (
            <TabBarItem key={t.section} asChild icon={t.icon} label={t.title} active={active}>
              <Link to={to(t.section)} params={{ projectId }} />
            </TabBarItem>
          );
        })}
        <TabBarItem
          icon="more_horiz"
          label="More"
          active={moreActive}
          aria-label="More pages"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        />
      </TabBar>
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
                <TabBarRow key={m.section} asChild icon={m.icon} active={active}>
                  <Link to={to(m.section)} params={{ projectId }} onClick={() => setOpen(false)}>
                    {m.title}
                  </Link>
                </TabBarRow>
              );
            })}
          </div>
          <div className="mx-1 mt-2 border-t border-outline-variant pt-2">
            <TabBarRow asChild icon="settings" active={path === "/settings"}>
              <Link to="/settings" onClick={() => setOpen(false)}>
                Settings
              </Link>
            </TabBarRow>
            <TabBarRow
              icon={<UserAvatar name={name} src={profile?.avatar_url} />}
              aria-label={`${name || "Your profile"}, open profile`}
              aria-haspopup="dialog"
              onClick={() => {
                setOpen(false);
                setProfileOpen(true);
              }}
            >
              <span className="min-w-0 truncate">{name}</span>
            </TabBarRow>
          </div>
        </SheetContent>
      </Sheet>
      <ProfilePanel open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

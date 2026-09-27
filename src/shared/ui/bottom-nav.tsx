import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/user-avatar";
import { ProfilePanel } from "@/components/profile-panel";
import { TabBar, TabBarItem, TabBarRow } from "@/components/ui/tab-bar";
import { useAuth } from "@/lib/auth";
import { useNavRole } from "@/shared/ui/nav-role";
import { navItemsFor, projectPath, projectRoute } from "@/shared/ui/nav-config";

/**
 * Phone bottom navigation (below md; `ui/tab-bar`'s `TabBar` is `md:hidden`, so this renders
 * unconditionally and CSS alone decides whether it shows). Both roles get it now: managers work on
 * site from their phones too. The desktop rail (`app-rail.tsx`) shows every section above md.
 */
export function BottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const { profile } = useAuth();
  const role = useNavRole();
  const isManager = role === "manager";
  const tabs = navItemsFor(role, "tab");
  const more = navItemsFor(role, "more");
  const { t } = useTranslation(["common"]);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Outside a project (reachable at /settings, and at /projects for a manager): a single row back.
  if (!projectId) {
    return (
      <TabBar>
        <TabBarItem asChild icon="arrow_back" label={t("actions.back")}>
          <Link to="/" />
        </TabBarItem>
      </TabBar>
    );
  }

  const moreActive =
    more.some((m) => projectPath(projectId, m.section) === path) || path === "/settings" || (isManager && path === "/projects");
  const name = profile?.full_name ?? "";

  return (
    <>
      <TabBar>
        {tabs.map((tab) => {
          const active = projectPath(projectId, tab.section) === path;
          return (
            <TabBarItem key={tab.key} asChild icon={tab.icon} label={t(tab.labelKey)} active={active}>
              <Link to={projectRoute(tab.section)} params={{ projectId }} />
            </TabBarItem>
          );
        })}
        <TabBarItem
          icon="more_horiz"
          label={t("nav.more")}
          active={moreActive}
          aria-label={t("nav.morePages")}
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
            <SheetTitle>{t("nav.more")}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1 px-1">
            {more.map((m) => {
              const active = projectPath(projectId, m.section) === path;
              return (
                <TabBarRow key={m.key} asChild icon={m.icon} active={active}>
                  <Link to={projectRoute(m.section)} params={{ projectId }} onClick={() => setOpen(false)}>
                    {t(m.labelKey)}
                  </Link>
                </TabBarRow>
              );
            })}
            {isManager && (
              <TabBarRow asChild icon="folder_open" active={path === "/projects"}>
                <Link to="/projects" onClick={() => setOpen(false)}>
                  {t("nav.allProjects")}
                </Link>
              </TabBarRow>
            )}
          </div>
          <div className="mx-1 mt-2 border-t border-outline-variant pt-2">
            <TabBarRow asChild icon="settings" active={path === "/settings"}>
              <Link to="/settings" onClick={() => setOpen(false)}>
                {t("nav.settings")}
              </Link>
            </TabBarRow>
            <TabBarRow
              icon={<UserAvatar name={name} src={profile?.avatar_url} />}
              aria-label={t("nav.openProfile", { name: name || t("nav.yourProfile") })}
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

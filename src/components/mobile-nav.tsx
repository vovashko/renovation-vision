import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/user-avatar";
import { ProfilePanel } from "@/components/profile-panel";
import { TabBar, TabBarItem, TabBarRow } from "@/components/ui/tab-bar";
import { useAuth } from "@/lib/auth";
import { navItemsFor, projectPath, projectRoute } from "@/shared/ui/nav-config";

// TODO(later task): this bar is client-only for now (see __root.tsx); make it role-aware.
const tabs = navItemsFor("client", "tab");
const more = navItemsFor("client", "more");

/** Client phone navigation (below md); managers keep the desktop nav rail. */
export function MobileTabBar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const { profile } = useAuth();
  // "work" is needed for the Progress nav item's `work:nav.progress` label (nav-config.ts).
  const { t } = useTranslation(["common", "work"]);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Outside a project (only reachable at /settings): a single row back to the project.
  if (!projectId) {
    return (
      <TabBar>
        <TabBarItem asChild icon="arrow_back" label={t("actions.back")}>
          <Link to="/" />
        </TabBarItem>
      </TabBar>
    );
  }

  const moreActive = more.some((m) => projectPath(projectId, m.section) === path) || path === "/settings";
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

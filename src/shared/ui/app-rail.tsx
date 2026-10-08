import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import logo from "@/assets/renovision-logo.svg";
import logoMark from "@/assets/renovision-mark.svg";
import { Rail, RailContent, RailFooter, RailGroup, RailHeader, RailItem, RailLogo } from "@/components/ui/rail";
import { UserAvatar } from "@/components/user-avatar";
import { ProfilePanel } from "@/components/profile-panel";
import { useAuth } from "@/lib/auth";
import { useNavRole } from "@/shared/ui/nav-role";
import { navItemsFor, projectPath, projectRoute } from "@/shared/ui/nav-config";
import { useNavCounts } from "@/shared/ui/nav-counts";

/** Avatar row pinned at the very bottom of the rail; opens the profile panel instead of navigating. */
function ProfileRailItem() {
  const { profile } = useAuth();
  const { t } = useTranslation(["common"]);
  const [open, setOpen] = useState(false);
  const name = profile?.full_name ?? "";
  return (
    <>
      <RailItem
        icon={<UserAvatar name={name} src={profile?.avatar_url} />}
        label={name || t("nav.profile")}
        aria-label={t("nav.openProfile", { name: name || t("nav.yourProfile") })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      />
      <ProfilePanel open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * Desktop navigation rail (md and up; phones use `bottom-nav.tsx`'s bottom bar; `ui/rail` itself is
 * `hidden md:block`, so this component renders unconditionally and CSS alone decides whether it
 * shows). Keeps the existing role logic: managers see "All projects" plus every section; clients
 * never see a manager-only one (`shared/ui/nav-config.ts`).
 */
export function AppRail() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const role = useNavRole();
  const isManager = role === "manager";
  const items = navItemsFor(role);
  const counts = useNavCounts(projectId, role);
  const { t } = useTranslation(["common"]);

  return (
    <Rail>
      <RailHeader>
        <RailLogo asChild mark={logoMark} lockup={logo}>
          <Link to="/" aria-label={t("nav.home")} />
        </RailLogo>
      </RailHeader>
      <RailContent>
        {isManager && (
          <RailItem asChild icon="folder_open" label={t("nav.allProjects")} active={path === "/projects"}>
            <Link to="/projects" />
          </RailItem>
        )}
        {projectId &&
          items.map((item) => {
            const href = projectPath(projectId, item.section);
            const count = item.counted ? (counts[item.key] ?? 0) : 0;
            const label = t(item.labelKey);
            return (
              <RailItem
                key={item.key}
                asChild
                icon={item.icon}
                label={label}
                badge={count}
                aria-label={count > 0 ? t("nav.withCount", { label, count }) : label}
                active={path === href}
              >
                <Link to={projectRoute(item.section)} params={{ projectId }} />
              </RailItem>
            );
          })}
        <RailGroup position="end">
          <RailItem asChild icon="settings" label={t("nav.settings")} active={path.startsWith("/settings")}>
            <Link to="/settings" />
          </RailItem>
        </RailGroup>
      </RailContent>
      <RailFooter>
        <ProfileRailItem />
      </RailFooter>
    </Rail>
  );
}

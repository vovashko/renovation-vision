import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import logo from "@/assets/renovision-logo.svg";
import logoMark from "@/assets/renovision-mark.svg";
import { Rail, RailContent, RailFooter, RailGroup, RailHeader, RailItem, RailLogo } from "@/components/ui/rail";
import { UserAvatar } from "@/components/user-avatar";
import { ProfilePanel } from "@/components/profile-panel";
import { useAuth } from "@/lib/auth";
import { projectNav, projectPath } from "@/lib/nav";

/** Avatar row pinned at the very bottom of the rail; opens the profile panel instead of navigating. */
function ProfileRailItem() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const name = profile?.full_name ?? "";
  return (
    <>
      <RailItem
        icon={<UserAvatar name={name} src={profile?.avatar_url} />}
        label={name || "Profile"}
        aria-label={`${name || "Your profile"}, open profile`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      />
      <ProfilePanel open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * Desktop navigation rail (md and up; phones use the bottom bar in `mobile-nav.tsx`). Keeps the
 * existing role logic: managers see "All projects" plus every section; clients never see a
 * manager-only one (`lib/nav.ts`).
 */
export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const isManager = useAuth().profile?.account_type === "manager";
  const items = projectNav.filter((i) => isManager || !i.managerOnly);

  return (
    <Rail>
      <RailHeader>
        <RailLogo asChild mark={logoMark} lockup={logo}>
          <Link to="/" aria-label="RenoVision home" />
        </RailLogo>
      </RailHeader>
      <RailContent>
        {isManager && (
          <RailItem asChild icon="folder_open" label="All projects" active={path === "/projects"}>
            <Link to="/projects" />
          </RailItem>
        )}
        {projectId &&
          items.map((item) => {
            const href = projectPath(projectId, item.section);
            const to = (item.section ? `/projects/$projectId/${item.section}` : "/projects/$projectId") as "/projects/$projectId";
            return (
              <RailItem key={item.title} asChild icon={item.icon} label={item.title} active={path === href}>
                <Link to={to} params={{ projectId }} />
              </RailItem>
            );
          })}
        <RailGroup position="end">
          <RailItem asChild icon="settings" label="Settings" active={path === "/settings"}>
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

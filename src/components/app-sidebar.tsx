import { Link, useParams, useRouterState, type LinkProps } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import logo from "@/assets/renovision-logo.svg";
import logoMark from "@/assets/renovision-mark.svg";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { ProfilePanel } from "@/components/profile-panel";
import { useAuth } from "@/lib/auth";
import { projectNav, projectPath } from "@/lib/nav";
import { cn } from "@/lib/utils";

const itemClass = (active: boolean) =>
  cn(
    "flex h-14 w-full shrink-0 items-center whitespace-nowrap rounded-lg text-on-surface transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
    active ? "bg-surface-container-high" : "hover:bg-surface",
  );

// Label fades in once the rail is expanded (hover or keyboard focus on any item inside it).
const labelClass =
  "min-w-0 truncate pr-4 text-label-lg opacity-0 transition-opacity duration-150 motion-reduce:transition-none group-hover/rail:opacity-100 group-focus-within/rail:opacity-100";

/** One 56px rail row: icon in a fixed 56px cell, label revealed on expand, tooltip while collapsed. */
function RailItem({ label, icon, active, ...linkProps }: { label: string; icon: string; active: boolean } & Omit<LinkProps, "children">) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link {...linkProps} aria-label={label} aria-current={active ? "page" : undefined} className={itemClass(active)}>
          <span className="grid w-14 shrink-0 place-items-center">
            <Icon name={icon} size={24} />
          </span>
          <span className={labelClass}>{label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Avatar row pinned at the very bottom; opens the profile panel instead of navigating. */
function ProfileItem() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const name = profile?.full_name ?? "";
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`${name || "Your profile"}, open profile`}
            aria-haspopup="dialog"
            className={cn(itemClass(false), "cursor-pointer text-left")}
          >
            <span className="grid w-14 shrink-0 place-items-center">
              <UserAvatar name={name} src={profile?.avatar_url} />
            </span>
            <span className={labelClass}>{name}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{name || "Profile"}</TooltipContent>
      </Tooltip>
      <ProfilePanel open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * Desktop navigation rail (md and up; phones use the bottom bar in `mobile-nav.tsx`). Sits in a
 * fixed 96px slot; the rail itself is absolutely positioned inside it, so expanding to 240px on
 * hover or keyboard focus overlays the page instead of pushing it. Settings sits above a divider
 * near the bottom; the profile avatar is pinned at the very bottom below it.
 */
export function AppSidebar(): ReactNode {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const isManager = useAuth().profile?.account_type === "manager";
  const items = projectNav.filter((i) => isManager || !i.managerOnly);

  return (
    <div className="sticky top-4 z-40 m-4 mr-0 hidden h-[calc(100dvh-2rem)] w-24 shrink-0 md:block">
      <nav
        aria-label="Main"
        className="group/rail absolute inset-y-0 left-0 z-20 flex w-24 flex-col overflow-hidden rounded-2xl border border-outline-variant bg-card px-5 py-5 transition-[width,box-shadow] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] focus-within:w-60 focus-within:shadow-float hover:w-60 hover:shadow-float motion-reduce:transition-none"
      >
        <Link
          to="/"
          aria-label="RenoVision home"
          className="relative mb-4 block h-10 w-[150px] shrink-0 rounded-md pl-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {/* Collapsed: the mark alone. Expanded: it cross-fades to the full lockup. */}
          <img
            src={logoMark}
            alt=""
            width={40}
            height={40}
            className="size-10 transition-opacity duration-150 group-focus-within/rail:opacity-0 group-hover/rail:opacity-0 motion-reduce:transition-none"
          />
          <img
            src={logo}
            alt=""
            width={150}
            height={40}
            className="absolute top-0 left-2 h-10 w-[150px] max-w-none opacity-0 transition-opacity duration-150 group-focus-within/rail:opacity-100 group-hover/rail:opacity-100 motion-reduce:transition-none"
          />
        </Link>

        <div className="-mx-5 flex min-h-0 flex-1 [scrollbar-width:none] flex-col gap-2 overflow-x-hidden overflow-y-auto px-5">
          {isManager && <RailItem to="/projects" label="All projects" icon="folder_open" active={path === "/projects"} />}
          {projectId &&
            items.map((item) => {
              const href = projectPath(projectId, item.section);
              const to = (item.section ? `/projects/$projectId/${item.section}` : "/projects/$projectId") as "/projects/$projectId";
              return (
                <RailItem key={item.title} to={to} params={{ projectId }} label={item.title} icon={item.icon} active={path === href} />
              );
            })}
          <div className="mt-auto">
            <RailItem to="/settings" label="Settings" icon="settings" active={path === "/settings"} />
          </div>
        </div>

        <div className="mt-2 shrink-0 border-t border-outline-variant pt-2">
          <ProfileItem />
        </div>
      </nav>
    </div>
  );
}

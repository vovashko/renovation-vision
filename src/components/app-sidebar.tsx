import { Link, useRouterState } from "@tanstack/react-router";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import markUrl from "@/assets/renovision-mark.svg";

const items = [
  { title: "Overview", url: "/", icon: "grid_view" },
  { title: "Stages", url: "/stages", icon: "checklist" },
  { title: "Photos", url: "/photos", icon: "photo_camera" },
  { title: "Plan", url: "/plan", icon: "floor" },
  { title: "Design", url: "/design", icon: "palette" },
  { title: "Chat", url: "/chat", icon: "chat_bubble" },
] as const;

/**
 * v5 navigation rail (md and up; phones use the bottom navigation bar).
 * A floating white rail with the mark on top and 56px icon items with tooltips.
 */
export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <nav
      aria-label="Main"
      className="sticky top-4 m-4 mr-0 hidden h-[calc(100dvh-2rem)] w-24 shrink-0 flex-col items-center gap-2 rounded-2xl border border-outline-variant bg-card py-5 md:flex"
    >
      <Link
        to="/"
        aria-label="Renovision home"
        className="mb-4 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <img src={markUrl} alt="" width={40} height={40} className="size-10" />
      </Link>
      {items.map((item) => {
        const active = path === item.url;
        return (
          <Tooltip key={item.url}>
            <TooltipTrigger asChild>
              <Link
                to={item.url}
                aria-label={item.title}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "grid size-14 place-items-center rounded-lg text-on-surface transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  active ? "bg-surface-container-high" : "hover:bg-surface",
                )}
              >
                <Icon name={item.icon} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{item.title}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

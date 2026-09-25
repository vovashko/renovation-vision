import { Link, useRouterState } from "@tanstack/react-router";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import logoUrl from "@/assets/renovision-logo.svg";
import markUrl from "@/assets/renovision-mark.svg";

const items = [
  { title: "Overview", url: "/", icon: "grid_view" },
  { title: "Stages", url: "/stages", icon: "checklist" },
  { title: "Photos", url: "/photos", icon: "photo_camera" },
  { title: "Plan", url: "/plan", icon: "floor" },
  { title: "Design", url: "/design", icon: "palette" },
  { title: "Chat", url: "/chat", icon: "chat_bubble" },
] as const;

// Width, shadow and label fade are driven by :hover / :focus-within on the rail (CSS only),
// so it expands on mouseenter or keyboard focus and collapses on mouseleave / blur.
const expanded = "group-hover/rail:opacity-100 group-focus-within/rail:opacity-100";

/**
 * v5 navigation rail (md and up; phones use the bottom navigation bar).
 * Sits in a fixed 96px slot; the rail itself is absolutely positioned inside it, so expanding
 * to 240px overlays the page instead of pushing it.
 */
export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="sticky top-4 z-40 m-4 mr-0 hidden h-[calc(100dvh-2rem)] w-24 shrink-0 md:block">
      <nav
        aria-label="Main"
        className="group/rail absolute inset-y-0 left-0 z-20 flex w-24 flex-col gap-2 overflow-hidden rounded-2xl border border-outline-variant bg-card px-5 py-5 transition-[width,box-shadow] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] focus-within:w-60 focus-within:shadow-float hover:w-60 hover:shadow-float motion-reduce:transition-none"
      >
        <Link
          to="/"
          aria-label="Renovision home"
          className="mb-4 block h-10 shrink-0 overflow-hidden rounded-md pl-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {/* The lockup is clipped to its mark while collapsed; the wordmark shows as the rail
              widens. Its dark wordmark is for light surfaces only, so dark mode keeps the mark. */}
          <img
            src={logoUrl}
            alt=""
            width={150}
            height={40}
            className="h-10 w-auto max-w-none dark:hidden"
          />
          <img src={markUrl} alt="" width={40} height={40} className="hidden size-10 dark:block" />
        </Link>
        {items.map((item) => {
          const active = path === item.url;
          return (
            <Link
              key={item.url}
              to={item.url}
              aria-label={item.title}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-14 w-full shrink-0 items-center whitespace-nowrap rounded-lg text-on-surface transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                active ? "bg-surface-container-high" : "hover:bg-surface",
              )}
            >
              <span className="grid w-14 shrink-0 place-items-center">
                <Icon name={item.icon} />
              </span>
              <span
                className={cn(
                  "text-label-lg opacity-0 transition-opacity duration-150 motion-reduce:transition-none",
                  expanded,
                )}
              >
                {item.title}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

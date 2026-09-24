import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";

const tabs = [
  { title: "Overview", url: "/", icon: "grid_view" },
  { title: "Stages", url: "/stages", icon: "checklist" },
  { title: "Photos", url: "/photos", icon: "photo_camera" },
  { title: "Chat", url: "/chat", icon: "chat_bubble" },
] as const;
const more = [
  { title: "Plan", url: "/plan", icon: "floor" },
  { title: "Design", url: "/design", icon: "palette" },
] as const;

export function MobileTabBar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);
  const keyboardOpen = useKeyboardInset().open;
  const moreActive = more.some((m) => m.url === path);
  // M3 navigation bar item: 64x32 active indicator pill behind the icon, label below.
  const cls = (active: boolean) =>
    cn(
      "group flex h-20 flex-1 flex-col items-center justify-center gap-1 text-label-md focus-visible:outline-none",
      active ? "text-on-surface" : "text-on-surface-variant",
    );
  const pill = (active: boolean) =>
    cn(
      "state-layer flex h-8 w-16 items-center justify-center rounded-full group-focus-visible:outline-2 group-focus-visible:outline-primary",
      active ? "bg-secondary-container text-on-secondary-container" : "",
    );

  return (
    <>
      <nav
        aria-label="Main"
        hidden={keyboardOpen}
        className="fixed inset-x-0 bottom-0 z-40 flex bg-surface-container pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {tabs.map((t) => (
          <Link
            key={t.url}
            to={t.url}
            className={cls(path === t.url)}
            aria-current={path === t.url ? "page" : undefined}
          >
            <span className={pill(path === t.url)}>
              <Icon name={t.icon} fill={path === t.url} />
            </span>
            {t.title}
          </Link>
        ))}
        <button
          onClick={() => setOpen(true)}
          className={cls(moreActive)}
          aria-label="More pages"
          aria-haspopup="dialog"
        >
          <span className={pill(moreActive)}>
            <Icon name="more_horiz" fill={moreActive} />
          </span>
          More
        </button>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-xl border-0 bg-surface-container-low pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1 px-3">
            {more.map((m) => (
              <Link
                key={m.url}
                to={m.url}
                onClick={() => setOpen(false)}
                className={cn(
                  "state-layer flex h-14 items-center gap-3 rounded-full pl-4 pr-6 text-label-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                  path === m.url
                    ? "bg-secondary-container text-on-secondary-container"
                    : "text-on-surface-variant",
                )}
              >
                <Icon name={m.icon} fill={path === m.url} />
                {m.title}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

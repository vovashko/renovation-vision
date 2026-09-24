import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";

const tabs = [
  { title: "Overview", url: "/", icon: "dashboard" },
  { title: "Stages", url: "/stages", icon: "checklist" },
  { title: "Photos", url: "/photos", icon: "photo_camera" },
  { title: "Chat", url: "/chat", icon: "chat" },
] as const;
const more = [
  { title: "Plan", url: "/plan", icon: "map" },
  { title: "Design", url: "/design", icon: "palette" },
] as const;

export function MobileTabBar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);
  const keyboardOpen = useKeyboardInset().open;
  const moreActive = more.some((m) => m.url === path);
  const cls = (active: boolean) =>
    `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`;

  return (
    <>
      <nav
        aria-label="Main"
        hidden={keyboardOpen}
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {tabs.map((t) => (
          <Link
            key={t.url}
            to={t.url}
            className={cls(path === t.url)}
            aria-current={path === t.url ? "page" : undefined}
          >
            <Icon name={t.icon} fill={path === t.url} />
            {t.title}
          </Link>
        ))}
        <button
          onClick={() => setOpen(true)}
          className={cls(moreActive)}
          aria-label="More pages"
          aria-haspopup="dialog"
        >
          <Icon name="more_horiz" fill={moreActive} />
          More
        </button>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid gap-2 px-4">
            {more.map((m) => (
              <Link
                key={m.url}
                to={m.url}
                onClick={() => setOpen(false)}
                className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 text-base font-medium ${path === m.url ? "border-primary text-primary" : ""}`}
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

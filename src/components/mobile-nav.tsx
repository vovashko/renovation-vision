import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, LayoutDashboard, ListChecks, Map, MessageCircle, MoreHorizontal, Palette } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const tabs = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Stages", url: "/stages", icon: ListChecks },
  { title: "Photos", url: "/photos", icon: Camera },
  { title: "Chat", url: "/chat", icon: MessageCircle },
] as const;
const more = [
  { title: "Plan", url: "/plan", icon: Map },
  { title: "Design", url: "/design", icon: Palette },
] as const;

export function MobileTabBar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);
  const moreActive = more.some((m) => m.url === path);
  const cls = (active: boolean) =>
    `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`;

  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {tabs.map((t) => (
          <Link key={t.url} to={t.url} className={cls(path === t.url)} aria-current={path === t.url ? "page" : undefined}>
            <t.icon className="h-5 w-5" />{t.title}
          </Link>
        ))}
        <button onClick={() => setOpen(true)} className={cls(moreActive)} aria-label="More pages" aria-haspopup="dialog">
          <MoreHorizontal className="h-5 w-5" />More
        </button>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SheetHeader><SheetTitle>More</SheetTitle></SheetHeader>
          <div className="grid gap-2 px-4">
            {more.map((m) => (
              <Link key={m.url} to={m.url} onClick={() => setOpen(false)} className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 text-base font-medium ${path === m.url ? "border-primary text-primary" : ""}`}>
                <m.icon className="h-5 w-5" />{m.title}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

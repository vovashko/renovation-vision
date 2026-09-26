import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { projectNav, projectPath } from "@/lib/nav";

const tabSections = ["", "stages", "photos", "chat"];
const clientNav = projectNav.filter((i) => !i.managerOnly);
const tabs = clientNav.filter((i) => tabSections.includes(i.section));
const more = clientNav.filter((i) => !tabSections.includes(i.section));

/** Client phone navigation. Managers keep the off-canvas sidebar. */
export function MobileTabBar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const [open, setOpen] = useState(false);
  if (!projectId) return null;

  const to = (section: string) => (section ? `/projects/$projectId/${section}` : "/projects/$projectId") as "/projects/$projectId";
  const moreActive = more.some((m) => projectPath(projectId, m.section) === path);
  const cls = (active: boolean) =>
    `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`;

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {tabs.map((t) => {
          const active = projectPath(projectId, t.section) === path;
          return (
            <Link
              key={t.section}
              to={to(t.section)}
              params={{ projectId }}
              className={cls(active)}
              aria-current={active ? "page" : undefined}
            >
              <t.icon className="h-5 w-5" />
              {t.title}
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} className={cls(moreActive)} aria-label="More pages" aria-haspopup="dialog">
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid gap-2 px-4">
            {more.map((m) => (
              <Link
                key={m.section}
                to={to(m.section)}
                params={{ projectId }}
                onClick={() => setOpen(false)}
                className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 text-base font-medium ${projectPath(projectId, m.section) === path ? "border-primary text-primary" : ""}`}
              >
                <m.icon className="h-5 w-5" />
                {m.title}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

import { Outlet, createFileRoute, redirect, useParams, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AppRail } from "@/shared/ui/app-rail";
import { BottomNav } from "@/shared/ui/bottom-nav";
import { QuickActions } from "@/shared/ui/quick-actions";
import { useProject } from "@/features/projects/hooks";
import { mfaHref, resolveStaffMfaStep } from "@/features/auth/hooks";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/database.types";

/**
 * The pathless layout every app page sits under (README → Sessions & route guards). Its beforeLoad
 * runs on the server on a hard load (a 307, no client-side "Loading…") and in the browser on
 * navigation:
 * - signed out → /login?redirect=<here>;
 * - aal1 staff while `staff_mfa_required()` → /mfa (has a verified factor) or /mfa/enroll (none);
 *   the setting is cached per session, and a failed read lets them through with a warning (RLS is
 *   the enforcement). Clients are never sent there.
 * Children get the signed-in `user` in their context, never null.
 */
export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    const { user, profile } = context.auth;
    if (!user) throw redirect({ to: "/login", search: { redirect: location.href } });
    const step = await resolveStaffMfaStep(context.queryClient, { user, profile });
    if (step !== "pass") throw redirect({ href: mfaHref(step, location.href) });
    return { user };
  },
  component: Shell,
});

/** Tinted panel as wide as the page content below it; scrolls with the page. `narrow` matches the
 * chat page's centered chat panel (`md:max-w-3xl` in routes/project/chat.tsx), instead of the
 * page-wide `max-w-7xl` every other route uses. */
function ProjectTopBar({ project, narrow }: { project?: ProjectSummary; narrow?: boolean }) {
  const { t } = useTranslation(["common"]);
  return (
    <header className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 md:px-8 md:pt-4">
      <Card variant="tinted" className={cn("mx-auto flex h-16 w-full items-center gap-3 px-5", narrow ? "max-w-3xl" : "max-w-7xl")}>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-title-md">{project?.name ?? "…"}</span>
          <span className="hidden truncate text-body-sm text-on-surface-variant md:block">{project?.address}</span>
          {project && (
            <div className="mt-1 flex items-center gap-2 md:hidden">
              <Progress value={project.overall_progress} onPanel aria-label={t("common:overallProgress")} className="flex-1" />
              <span className="text-label-sm text-on-surface-variant tabular-nums">{project.overall_progress}%</span>
            </div>
          )}
        </div>
      </Card>
    </header>
  );
}

function Shell() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const { data: project } = useProject(projectId);
  // The Overview has no top bar: its project card already shows the same information.
  const isOverview = !!projectId && path.replace(/\/$/, "") === `/projects/${projectId}`;
  // Top bar only inside a project, past the Overview. Projects list, Settings and Overview start at the top.
  const showTopBar = !!projectId && !isOverview;
  const isChat = !!projectId && path.replace(/\/$/, "") === `/projects/${projectId}/chat`;

  return (
    <div className="flex min-h-screen w-full bg-surface text-on-surface">
      <AppRail />
      <div className="flex min-w-0 flex-1 flex-col">
        {showTopBar && <ProjectTopBar project={project} narrow={isChat} />}
        <main
          className={cn(
            "min-w-0 flex-1 p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:px-8 md:pb-8",
            // Both roles now get the phone bottom bar (`bottom-nav.tsx`); `ui/tab-bar` is `md:hidden`,
            // so the extra bottom padding above only matters below md and md:pb-8 replaces it above.
            showTopBar ? "md:pt-6" : "pt-[max(calc(var(--spacing)*10),env(safe-area-inset-top))]",
          )}
        >
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <QuickActions />
    </div>
  );
}

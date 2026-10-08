import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { ProjectHeader } from "@/features/work/ui/project-header";
import { OverviewStats } from "@/features/work/ui/overview-stats";
import { StageTimeline } from "@/features/work/ui/stage-timeline";
import { FloorPlan } from "@/features/work/ui/floor-plan";
import { SelectedRoomPanel } from "@/features/work/ui/selected-room-panel";
import { roomsQuery, stagesQuery, useRooms, useStages } from "@/features/work/hooks";
import { useProject } from "@/features/projects/hooks";
import { ManagerOverview } from "@/features/projects/ui/manager-overview";
import { YourContactCard } from "@/features/people/ui/your-contact-card";
import { PageLoading } from "@/components/page-header";
import { useNavRole } from "@/shared/ui/nav-role";
import { daysLate } from "@/domain/attention";
import { useFormat } from "@/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/projects/$projectId/")({
  head: () => ({
    meta: [{ title: "Overview — RenoVision" }, { name: "description", content: "Project details, schedule and progress at a glance." }],
  }),
  // Both overviews wait for the project, stages and rooms. Fetch them during SSR so a hard load
  // renders the real page (the layout guard already cached the project); in the browser the
  // components' own queries take over, so navigation isn't held up.
  loader: async ({ context, params }) => {
    if (!import.meta.env.SSR) return;
    await Promise.all([
      context.queryClient.prefetchQuery(stagesQuery(params.projectId)),
      context.queryClient.prefetchQuery(roomsQuery(params.projectId)),
    ]);
  },
  component: ProjectHome,
});

/** Managers get the status/shortcuts/client/team home; clients get the read-only project overview. */
function ProjectHome() {
  const { projectId } = Route.useParams();
  const isManager = useNavRole() === "manager";
  return isManager ? <ManagerOverview projectId={projectId} /> : <ClientOverview projectId={projectId} />;
}

const sectionLink = cn(buttonVariants({ variant: "ghost" }), "-mr-3 shrink-0");

function ClientOverview({ projectId }: { projectId: string }) {
  const { t } = useTranslation(["work", "common"]);
  const format = useFormat();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: stages } = useStages(projectId);
  const { data: rooms } = useRooms(projectId);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId && rooms?.length) setRoomId(rooms[0].id);
  }, [rooms, roomId]);

  if (!project || !stages || !rooms) return <PageLoading />;

  const activeRoom = rooms.find((r) => r.id === roomId);
  const params = { projectId };
  const timelineSearch = { view: "timeline" as const };
  const planSearch = { view: "plan" as const };
  const timelineStages = stages.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    start: format.date(s.start_date, "short"),
    end: format.date(s.end_date, "short"),
    progress: s.progress,
    lateDays: daysLate(s),
  }));
  const goToStage = (s: { id: string }) => navigate({ to: "/projects/$projectId/progress", params, search: timelineSearch, hash: s.id });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <ProjectHeader
        name={project.name}
        address={project.address}
        managerName={project.manager_name}
        progress={project.overall_progress}
        currentStage={project.current_stage}
      />

      <OverviewStats project={project} stages={stages} />

      {project.schedule_note && (
        <Note className="-mt-4">
          <span className="font-medium text-on-surface">{t("work:overview.scheduleNote")}</span>
          {project.schedule_note}
        </Note>
      )}

      <YourContactCard projectId={projectId} />

      <section aria-labelledby="stage-timeline">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="stage-timeline" className="text-title-lg">
            {t("work:overview.stageTimeline")}
          </h2>
          <Link to="/projects/$projectId/progress" search={timelineSearch} params={params} className={sectionLink}>
            {t("work:overview.allStages")}
            <Icon name="arrow_forward" size={20} />
          </Link>
        </div>
        <StageTimeline stages={timelineStages} onSelect={goToStage} />
      </section>

      <section aria-labelledby="floor-plan">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="floor-plan" className="text-title-lg">
            {t("work:overview.floorPlanVisualisation")}
          </h2>
          <Link to="/projects/$projectId/design" search={planSearch} params={params} className={sectionLink}>
            {t("work:overview.openPlan")}
            <Icon name="arrow_forward" size={20} />
          </Link>
        </div>
        <FloorPlan
          rooms={rooms}
          activeId={roomId}
          onSelect={(r) => setRoomId(r.id)}
          detail={
            activeRoom && (
              <SelectedRoomPanel room={activeRoom}>
                {activeRoom.client_note && <p className="mt-5 text-body-md text-on-surface-variant">{activeRoom.client_note}</p>}
              </SelectedRoomPanel>
            )
          }
        />
      </section>
    </div>
  );
}

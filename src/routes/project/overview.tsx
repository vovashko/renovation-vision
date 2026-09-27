import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { ProjectHeader } from "@/features/work/ui/project-header";
import { OverviewStats } from "@/features/work/ui/overview-stats";
import { StageTimeline } from "@/features/work/ui/stage-timeline";
import { FloorPlan } from "@/features/work/ui/floor-plan";
import { SelectedRoomPanel } from "@/features/work/ui/selected-room-panel";
import { ManagerOverview } from "@/components/manager/manager-overview";
import { PageLoading } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { useProject, useRooms, useStages } from "@/lib/queries";
import { daysLate } from "@/lib/attention";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/$projectId/")({
  head: () => ({
    meta: [{ title: "Overview — RenoVision" }, { name: "description", content: "Project details, schedule and progress at a glance." }],
  }),
  component: ProjectHome,
});

/** Managers get the status/shortcuts/client/team home; clients get the read-only project overview. */
function ProjectHome() {
  const { projectId } = Route.useParams();
  const isManager = useAuth().profile?.account_type === "manager";
  return isManager ? <ManagerOverview projectId={projectId} /> : <ClientOverview projectId={projectId} />;
}

const sectionLink = cn(buttonVariants({ variant: "ghost" }), "-mr-3 shrink-0");

function ClientOverview({ projectId }: { projectId: string }) {
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
          <span className="font-medium text-on-surface">Schedule note: </span>
          {project.schedule_note}
        </Note>
      )}

      <section aria-labelledby="stage-timeline">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="stage-timeline" className="text-title-lg">
            Stage timeline
          </h2>
          <Link to="/projects/$projectId/stages" params={params} className={sectionLink}>
            All stages
            <Icon name="arrow_forward" size={20} />
          </Link>
        </div>
        <StageTimeline
          stages={stages.map((s) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            start: shortDate(s.start_date),
            end: shortDate(s.end_date),
            progress: s.progress,
            lateDays: daysLate(s),
          }))}
          onSelect={(s) => navigate({ to: "/projects/$projectId/stages", params, hash: s.id })}
        />
      </section>

      <section aria-labelledby="floor-plan">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="floor-plan" className="text-title-lg">
            Floor plan visualisation
          </h2>
          <Link to="/projects/$projectId/plan" params={params} className={sectionLink}>
            Open plan
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

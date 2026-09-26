import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { ProjectHeaderCard } from "@/components/project-header-card";
import { Stat } from "@/components/stat-card";
import { StageTimelineRow } from "@/components/stage-timeline-row";
import { FloorPlan, RoomDetail } from "@/components/floor-plan";
import { ManagerOverview } from "@/components/manager/manager-overview";
import { PageLoading } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { useProject, useRooms, useStages } from "@/lib/queries";
import { budgetStatus, daysLate } from "@/lib/attention";
import { longDate, money, shortDate } from "@/lib/format";
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
  const budget = budgetStatus(project);
  const lateStages = stages.filter((s) => daysLate(s) > 0).length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <ProjectHeaderCard
        name={project.name}
        address={project.address}
        managerName={project.manager_name}
        progress={project.overall_progress}
        currentStage={project.current_stage}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Project facts">
        <Stat label="Started" value={longDate(project.start_date)} sub={`Target: ${longDate(project.target_date)}`} />
        <Stat
          label="Stages done"
          value={String(project.stages_done)}
          unit={`/ ${project.stages_total}`}
          delta={lateStages ? `${lateStages} ${lateStages === 1 ? "stage" : "stages"} late` : "On schedule"}
          deltaTone={lateStages ? "attention" : "good"}
        />
        <Stat
          label="Budget spent"
          value={money(project.spent)}
          attention={budget.over}
          delta={budget.over ? `↑ ${budget.overPct}% over` : `${budget.usedPct}% used`}
          deltaTone={budget.over ? "attention" : "good"}
          sub={`of the ${money(project.budget)} plan`}
        />
        <Stat label="Site manager" value={project.manager_name || "—"} sub="Your point of contact" />
      </section>

      {project.schedule_note && (
        <p className="-mt-4 rounded-lg bg-surface-container-low px-4 py-3 text-body-md text-on-surface-variant">
          <span className="font-medium text-on-surface">Schedule note: </span>
          {project.schedule_note}
        </p>
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
        <ul className="space-y-2">
          {stages.map((s, i) => (
            <li key={s.id}>
              <StageTimelineRow
                index={i + 1}
                name={s.name}
                status={s.status}
                start={shortDate(s.start_date)}
                end={shortDate(s.end_date)}
                progress={s.progress}
                lateDays={daysLate(s)}
                onClick={() => navigate({ to: "/projects/$projectId/stages", params, hash: s.id })}
              />
            </li>
          ))}
        </ul>
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
              <RoomDetail room={activeRoom}>
                {activeRoom.client_note && <p className="mt-5 text-body-md text-on-surface-variant">{activeRoom.client_note}</p>}
              </RoomDetail>
            )
          }
        />
      </section>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, DollarSign, TrendingUp, User } from "lucide-react";
import { ProjectHeaderCard } from "@/components/project-header-card";
import { Stat } from "@/components/stat-card";
import { StageTimelineRow } from "@/components/stage-timeline-row";
import { FloorPlan, RoomDetail } from "@/components/floor-plan";
import { ManagerOverview } from "@/components/manager/manager-overview";
import { PageLoading } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { useProject, useRooms, useStages } from "@/lib/queries";
import { longDate, money, scheduleFill, scheduleLabel, shortDate } from "@/lib/format";

export const Route = createFileRoute("/projects/$projectId/")({
  head: () => ({
    meta: [
      { title: "Overview — RenoVision" },
      { name: "description", content: "Project details, schedule and progress at a glance." },
    ],
  }),
  component: ProjectHome,
});

/** Managers get the status/shortcuts/client/team home; clients get the read-only project overview. */
function ProjectHome() {
  const { projectId } = Route.useParams();
  const isManager = useAuth().profile?.account_type === "manager";
  return isManager ? <ManagerOverview projectId={projectId} /> : <ClientOverview projectId={projectId} />;
}

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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <ProjectHeaderCard
        name={project.name}
        address={project.address}
        managerName={project.manager_name}
        progress={project.overall_progress}
        currentStage={project.current_stage}
        badges={
          <span className="rounded-full px-3 py-1 text-xs font-medium text-white" style={{ background: scheduleFill[project.schedule_status] }}>
            {scheduleLabel[project.schedule_status]}
          </span>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Calendar} label="Started" value={longDate(project.start_date)} sub={`Target: ${longDate(project.target_date)}`} />
        <Stat
          icon={TrendingUp}
          label="Stages done"
          value={`${project.stages_done}/${project.stages_total}`}
          sub={<span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: scheduleFill[project.schedule_status] }} />{scheduleLabel[project.schedule_status]}</span>}
        />
        <Stat icon={DollarSign} label="Budget" value={money(project.budget)} sub={`Spent ${money(project.spent)}`} />
        <Stat icon={User} label="Site manager" value={project.manager_name || "—"} sub="Your point of contact" />
      </section>

      {project.schedule_note && (
        <p className="-mt-4 rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          <span className="font-medium text-foreground">Schedule note: </span>{project.schedule_note}
        </p>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-semibold">Stage timeline</h2>
          <Link to="/projects/$projectId/stages" params={{ projectId }} className="text-sm text-primary hover:underline">All stages →</Link>
        </div>
        <div className="space-y-3">
          {stages.map((s) => (
            <StageTimelineRow
              key={s.id}
              name={s.name}
              status={s.status}
              start={shortDate(s.start_date)}
              end={shortDate(s.end_date)}
              progress={s.progress}
              onClick={() => navigate({ to: "/projects/$projectId/stages", params: { projectId }, hash: s.id })}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-semibold">Floor plan visualisation</h2>
          <Link to="/projects/$projectId/plan" params={{ projectId }} className="text-sm text-primary hover:underline">Open plan →</Link>
        </div>
        <FloorPlan
          rooms={rooms}
          activeId={roomId}
          onSelect={(r) => setRoomId(r.id)}
          detail={activeRoom && (
            <RoomDetail room={activeRoom}>
              {activeRoom.client_note && <p className="mt-5 text-sm text-muted-foreground">{activeRoom.client_note}</p>}
            </RoomDetail>
          )}
        />
      </section>
    </div>
  );
}

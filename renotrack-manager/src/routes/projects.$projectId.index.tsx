import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProjectHeaderCard } from "@/components/ui/project-header-card";
import { Stat } from "@/components/ui/stat-card";
import { StageTimelineRow } from "@/components/ui/stage-timeline-row";
import { FloorPlan, RoomDetail } from "@/components/ui/floor-plan";
import { Field, FormSheet, selectCls } from "@/components/form-sheet";
import { PageLoading } from "@/components/page-header";
import { api, type ProjectPatch } from "@/lib/api";
import { keys, useProject, useRooms, useSave, useStages } from "@/lib/queries";
import { findInconsistencies } from "@/lib/consistency";
import { longDate, money, scheduleFill, scheduleLabel, shortDate } from "@/lib/format";
import type { ProjectSummary, ScheduleStatus } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/")({
  head: () => ({
    meta: [
      { title: "Overview — RenoTrack Manager" },
      { name: "description", content: "Project details, schedule and progress at a glance." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: stages } = useStages(projectId);
  const { data: rooms } = useRooms(projectId);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!roomId && rooms?.length) setRoomId(rooms[0].id);
  }, [rooms, roomId]);

  if (!project || !stages || !rooms) return <PageLoading />;

  const warnings = findInconsistencies(project, stages, rooms);
  const activeRoom = rooms.find((r) => r.id === roomId);
  const warnTo = { stages: "/projects/$projectId/stages", plan: "/projects/$projectId/plan", overview: "/projects/$projectId" } as const;

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
        actions={<Button variant="outline" onClick={() => setEditing(true)} className="min-h-11 gap-2"><Icon name="edit" size={20} /> Edit project details</Button>}
      />

      {warnings.length > 0 && (
        <section className="rounded-xl border border-status-blocked/40 bg-card p-5 shadow-[var(--shadow-soft)]" aria-label="Consistency checks">
          <div className="flex items-center gap-2 font-semibold"><Icon name="warning" size={22} className="text-status-blocked" /> Check before your client sees it</div>
          <ul className="mt-3 space-y-2 text-sm">
            {warnings.map((w) => (
              <li key={w.text} className="flex flex-wrap items-center justify-between gap-2">
                <span>{w.text}</span>
                {w.to === "overview" ? (
                  <button onClick={() => setEditing(true)} className="text-primary hover:underline">Fix →</button>
                ) : (
                  <Link to={warnTo[w.to]} params={{ projectId }} className="text-primary hover:underline">Fix →</Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon="calendar_month" label="Started" value={longDate(project.start_date)} sub={`Target: ${longDate(project.target_date)}`} />
        <Stat
          icon="trending_up"
          label="Stages done"
          value={`${project.stages_done}/${project.stages_total}`}
          sub={<span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: scheduleFill[project.schedule_status] }} />{scheduleLabel[project.schedule_status]}</span>}
        />
        <Stat icon="attach_money" label="Budget" value={money(project.budget)} sub={`Spent ${money(project.spent)}`} />
        <Stat icon="person" label="Client" value={project.client_name || "—"} sub="Primary contact" />
      </section>

      {project.schedule_note && (
        <p className="-mt-4 rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
          <span className="font-medium text-foreground">Schedule note for the client: </span>{project.schedule_note}
        </p>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-semibold">Stage timeline</h2>
          <Link to="/projects/$projectId/stages" params={{ projectId }} className="text-sm text-primary hover:underline">Edit stages →</Link>
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
          <Link to="/projects/$projectId/plan" params={{ projectId }} className="text-sm text-primary hover:underline">Edit rooms →</Link>
        </div>
        <FloorPlan
          rooms={rooms.map((r) => ({ ...r, muted: !r.is_visible }))}
          activeId={roomId}
          onSelect={(r) => setRoomId(r.id)}
          detail={activeRoom && (
            <RoomDetail room={activeRoom}>
              {activeRoom.client_note && <p className="mt-5 text-sm text-muted-foreground">{activeRoom.client_note}</p>}
              <Link to="/projects/$projectId/plan" params={{ projectId }} search={{ room: activeRoom.id }} className="mt-5 inline-flex text-sm text-primary hover:underline">
                Update {activeRoom.name} →
              </Link>
            </RoomDetail>
          )}
        />
      </section>

      <ProjectDetailsSheet project={project} open={editing} onOpenChange={setEditing} />
    </div>
  );
}

function ProjectDetailsSheet({ project, open, onOpenChange }: { project: ProjectSummary; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [form, setForm] = useState<ProjectPatch>({});
  useEffect(() => {
    if (open) {
      const { name, address, client_name, start_date, target_date, budget, schedule_status, schedule_note } = project;
      setForm({ name, address, client_name, start_date, target_date, budget, schedule_status, schedule_note });
    }
  }, [open, project]);
  const save = useSave(project.id, (patch: ProjectPatch) => api.updateProject(project.id, patch), {
    invalidate: [keys.project(project.id)],
    success: "Project updated — the client app shows it now",
  });
  const set = <K extends keyof ProjectPatch>(k: K, v: ProjectPatch[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title="Project details" description="Everything here is visible to the client.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ ...form, budget: Number(form.budget) || 0, start_date: form.start_date || null, target_date: form.target_date || null }, { onSuccess: () => onOpenChange(false) });
        }}
      >
        <Field id="pd-name" label="Project name"><Input id="pd-name" required value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} className="h-11" /></Field>
        <Field id="pd-address" label="Address"><Input id="pd-address" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} className="h-11" /></Field>
        <Field id="pd-client" label="Client name"><Input id="pd-client" value={form.client_name ?? ""} onChange={(e) => set("client_name", e.target.value)} className="h-11" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="pd-start" label="Start"><Input id="pd-start" type="date" value={form.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} className="h-11" /></Field>
          <Field id="pd-target" label="Target"><Input id="pd-target" type="date" value={form.target_date ?? ""} onChange={(e) => set("target_date", e.target.value)} className="h-11" /></Field>
        </div>
        <Field id="pd-budget" label="Budget ($)" hint="Spent is calculated from the expenses on the Budget page.">
          <Input id="pd-budget" type="number" min={0} step={100} value={form.budget ?? 0} onChange={(e) => set("budget", Number(e.target.value))} className="h-11" />
        </Field>
        <Field id="pd-schedule" label="Schedule status" hint="Shown on the client's overview. Changing it notifies the client.">
          <select id="pd-schedule" value={form.schedule_status} onChange={(e) => set("schedule_status", e.target.value as ScheduleStatus)} className={selectCls}>
            {(Object.keys(scheduleLabel) as ScheduleStatus[]).map((s) => <option key={s} value={s}>{scheduleLabel[s]}</option>)}
          </select>
        </Field>
        <Field id="pd-note" label="Schedule note for the client">
          <Textarea id="pd-note" value={form.schedule_note ?? ""} onChange={(e) => set("schedule_note", e.target.value)} placeholder="Why the schedule is what it is, in plain words." />
        </Field>
        <Button type="submit" disabled={save.isPending} className="min-h-11 w-full">{save.isPending ? "Saving…" : "Save details"}</Button>
      </form>
    </FormSheet>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProjectHeaderCard } from "@/components/ui/project-header-card";
import { Stat } from "@/components/ui/stat-card";
import { StageTimelineRow } from "@/components/ui/stage-timeline-row";
import { FloorPlan, RoomDetail } from "@/components/ui/floor-plan";
import { Field, FormSheet, selectCls } from "@/components/form-sheet";
import { PageLoading } from "@/components/page-header";
import { ManagerBadge } from "@/components/manager-badge";
import { PhotoThumbs } from "@/components/photo-thumbs";
import { SectionHeader } from "@/components/section-header";
import { api, type ProjectPatch } from "@/lib/api";
import { keys, useMembers, usePhotos, useProject, useRooms, useSave, useStages } from "@/lib/queries";
import { budgetStatus, daysLate, projectToday } from "@/lib/attention";
import { cn } from "@/lib/utils";
import { findInconsistencies } from "@/lib/consistency";
import { longDate, scheduleLabel, shortDate } from "@/lib/format";
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
  const { data: photos = [] } = usePhotos(projectId);
  const { data: members = [] } = useMembers(projectId);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!roomId && rooms?.length) setRoomId(rooms[0].id);
  }, [rooms, roomId]);

  if (!project || !stages || !rooms) return <PageLoading />;

  const warnings = findInconsistencies(project, stages, rooms);
  const activeRoom = rooms.find((r) => r.id === roomId);
  const warnTo = { stages: "/projects/$projectId/stages", plan: "/projects/$projectId/plan", overview: "/projects/$projectId" } as const;
  const current = stages.find((s) => s.status === "progress");
  const done = stages.filter((s) => s.status === "done").length;
  const lateStages = stages.filter((s) => daysLate(s) > 0).length;
  const budget = budgetStatus(project);
  const spent = kUsd(project.spent);
  const plan = kUsd(project.budget);
  const onSchedule = project.schedule_status === "on_schedule";
  const nameOf = (id: string | null) => members.find((m) => m.user_id === id)?.profile.full_name ?? "the team";
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name;
  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <ProjectHeaderCard
        name={project.name}
        address={project.address}
        managerName={project.manager_name}
        progress={project.overall_progress}
        currentStage={current?.name ?? null}
        badges={
          <>
            <ManagerBadge />
            {!onSchedule && (
              <Badge variant="attention" size="compact" icon="schedule">
                {scheduleLabel[project.schedule_status]}
              </Badge>
            )}
          </>
        }
        actions={
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Icon name="edit" size={20} />
            Edit project details
          </Button>
        }
      />

      {warnings.length > 0 && (
        <Card attention className="p-5" aria-label="Consistency checks">
          <div className="flex items-center gap-2 pr-4 text-title-md">
            <Icon name="warning" size={22} className="text-attention" /> Check before your client sees it
          </div>
          <ul className="mt-3 divide-y divide-outline-variant text-body-md">
            {warnings.map((w) => (
              <li key={w.text} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{w.text}</span>
                {w.to === "overview" ? (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="-mr-3">
                    Fix
                    <Icon name="arrow_forward" size={20} />
                  </Button>
                ) : (
                  <Link to={warnTo[w.to]} params={{ projectId }} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-mr-3")}>
                    Fix
                    <Icon name="arrow_forward" size={20} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Project facts">
        <Stat label="Started" value={shortDate(project.start_date)} note={`Target: ${longDate(project.target_date)}`} />
        <Stat
          label="Stages done"
          value={String(done)}
          unit={`/ ${stages.length}`}
          delta={lateStages ? `${lateStages} late` : scheduleLabel[project.schedule_status]}
          deltaTone={lateStages || !onSchedule ? "attention" : "good"}
        />
        <Stat
          label="Budget spent"
          value={spent.value}
          unit={spent.unit}
          attention={budget.over}
          delta={budget.over ? `↑ ${budget.overPct}% over` : `${budget.usedPct}% used`}
          deltaTone={budget.over ? "attention" : "good"}
          note={`of the ${plan.value}${plan.unit} plan`}
        />
        <Stat label="Client" value={project.client_name || "—"} note="Primary contact" />
      </section>

      {project.schedule_note && (
        <Card className="p-4 text-body-md text-on-surface-variant">
          <span className="font-medium text-on-surface">Schedule note for the client: </span>
          {project.schedule_note}
        </Card>
      )}

      <section aria-labelledby="latest-photos">
        <SectionHeader
          id="latest-photos"
          title="Latest photos"
          sub={photos[0] ? `Latest from ${nameOf(photos[0].uploaded_by)} · ${dayLabel(photos[0].taken_at)}` : undefined}
          link={{ to: "/projects/$projectId/photos", params: { projectId } }}
          linkLabel="All photos"
        />
        {photos.length ? (
          <PhotoThumbs
            photos={photos}
            max={4}
            className="grid max-w-2xl grid-cols-4 gap-2 md:gap-3"
            toItem={(p) => ({
              src: p.url,
              alt: p.alt,
              title: p.caption,
              subtitle: `${dayLabel(p.taken_at)} · ${nameOf(p.uploaded_by)}`,
              tags: [stageName(p.stage_id), roomName(p.room_id), p.status === "draft" ? "Draft" : undefined].filter((t): t is string => !!t),
            })}
          />
        ) : (
          <EmptyState icon="photo_camera" text="No photos yet. Add today's progress from the Photos page." />
        )}
      </section>

      <section aria-labelledby="stage-timeline">
        <SectionHeader
          id="stage-timeline"
          title="Stage timeline"
          link={{ to: "/projects/$projectId/stages", params: { projectId } }}
          linkLabel="Edit stages"
        />
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
                onClick={() => navigate({ to: "/projects/$projectId/stages", params: { projectId }, hash: s.id })}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="floor-plan">
        <SectionHeader
          id="floor-plan"
          title="Floor plan visualisation"
          link={{ to: "/projects/$projectId/plan", params: { projectId } }}
          linkLabel="Edit rooms"
        />
        <FloorPlan
          rooms={rooms.map((r) => ({ ...r, muted: !r.is_visible }))}
          activeId={roomId}
          onSelect={(r) => setRoomId(r.id)}
          detail={
            activeRoom && (
              <RoomDetail room={activeRoom}>
                {activeRoom.client_note && <p className="mt-5 text-body-md text-on-surface-variant">{activeRoom.client_note}</p>}
                <Link
                  to="/projects/$projectId/plan"
                  params={{ projectId }}
                  search={{ room: activeRoom.id }}
                  className={cn(buttonVariants({ variant: "ghost" }), "mt-3 -ml-3")}
                >
                  Update {activeRoom.name}
                  <Icon name="arrow_forward" size={20} />
                </Link>
              </RoomDetail>
            )
          }
        />
      </section>

      <ProjectDetailsSheet project={project} open={editing} onOpenChange={setEditing} />
    </div>
  );
}

/** "$51.2" + "k", like the client app's budget card. */
function kUsd(n: number) {
  return { value: `$${(n / 1000).toFixed(1)}`, unit: "k" };
}

/** "Today", "Yesterday" or "Apr 17", relative to the project's today. */
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = projectToday();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(today) - day(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
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

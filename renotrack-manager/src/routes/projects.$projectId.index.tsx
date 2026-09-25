import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormSheet, NativeSelect } from "@/components/form-sheet";
import { PageLoading } from "@/components/page-header";
import { UploadSheet } from "@/components/photo-upload-sheet";
import { ExpenseSheet } from "@/components/expense-sheet";
import {
  ClientCard,
  ClientContactSheet,
  CrewSheet,
  ShortcutsCard,
  StatusCard,
  TeamCard,
  type Issue,
} from "@/components/overview-cards";
import { api, type ProjectPatch } from "@/lib/api";
import { keys, useCrew, useInternal, useMembers, useProject, useRooms, useSave, useStages } from "@/lib/queries";
import { budgetStatus, daysLate, daysUntil, lateLabel } from "@/lib/attention";
import { findInconsistencies } from "@/lib/consistency";
import { scheduleLabel, shortDate } from "@/lib/format";
import type { CrewMember, ProjectSummary, ScheduleStatus } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/")({
  head: () => ({
    meta: [
      { title: "Overview — Renovision Manager" },
      { name: "description", content: "Is the project on track, who to call, and one-click shortcuts." },
    ],
  }),
  component: Overview,
});

type Sheet = "details" | "contact" | "photo" | "expense" | null;

function Overview() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: stages } = useStages(projectId);
  const { data: rooms } = useRooms(projectId);
  const { data: members = [] } = useMembers(projectId);
  const { data: internal } = useInternal(projectId);
  const { data: crew = [] } = useCrew(projectId);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [person, setPerson] = useState<CrewMember | "new" | null>(null);
  const sheetProps = (name: Exclude<Sheet, null>) => ({ open: sheet === name, onOpenChange: (v: boolean) => setSheet(v ? name : null) });

  if (!project || !stages || !rooms) return <PageLoading />;

  const params = { projectId };
  const budget = budgetStatus(project);
  const current = stages.find((s) => s.status === "progress");
  const done = stages.filter((s) => s.status === "done").length;
  const onTrack = project.schedule_status === "on_schedule";
  const left = project.target_date ? daysUntil(project.target_date) : null;

  // Blocked first, then late, then money, then data checks.
  const issues: Issue[] = [
    ...stages
      .filter((s) => s.status === "blocked")
      .map((s): Issue => ({ key: `sb-${s.id}`, tone: "blocked", title: `${s.name} is blocked`, detail: s.client_note || undefined, link: { to: "/projects/$projectId/stages", params, hash: s.id } })),
    ...rooms
      .filter((r) => r.status === "blocked")
      .map((r): Issue => ({ key: `rb-${r.id}`, tone: "blocked", title: `${r.name} is blocked`, detail: r.client_note || undefined, link: { to: "/projects/$projectId/plan", params, search: { room: r.id } } })),
    ...stages
      .filter((s) => s.status !== "blocked" && daysLate(s) > 0)
      .map((s): Issue => ({ key: `sl-${s.id}`, tone: "attention", title: `${s.name} is ${lateLabel(daysLate(s))}`, detail: `Was due ${shortDate(s.end_date)} · ${s.progress}% done`, link: { to: "/projects/$projectId/stages", params, hash: s.id } })),
    ...(budget.over
      ? [{ key: "budget", tone: "attention", title: `Over budget by ${budget.overPct}%`, detail: `$${project.spent.toLocaleString("en-US")} spent of $${project.budget.toLocaleString("en-US")}`, link: { to: "/projects/$projectId/budget", params } } satisfies Issue]
      : []),
    ...findInconsistencies(project, stages, rooms).map(
      (w): Issue =>
        w.to === "overview"
          ? { key: w.text, tone: "check", title: w.text, onClick: () => setSheet("details") }
          : { key: w.text, tone: "check", title: w.text, link: { to: w.to === "stages" ? "/projects/$projectId/stages" : "/projects/$projectId/plan", params } },
    ),
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="min-w-0">
        <h1 className="text-headline-md sm:text-headline-lg">{project.name}</h1>
        <p className="text-body-lg text-on-surface-variant">{project.address}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <StatusCard
            onTrack={onTrack}
            headline={onTrack ? "On track" : scheduleLabel[project.schedule_status]}
            note={project.schedule_note || undefined}
            progress={project.overall_progress}
            currentStage={current?.name ?? null}
            issues={issues}
            facts={[
              { label: "Stages done", value: `${done} of ${stages.length}` },
              { label: "Target", value: project.target_date ? shortDate(project.target_date) : "—" },
              {
                label: left !== null && left < 0 ? "Past target" : "Days left",
                value: left === null ? "—" : `${Math.abs(left)} ${Math.abs(left) === 1 ? "day" : "days"}`,
                attention: left !== null && left < 0,
              },
              { label: "Budget used", value: `${budget.usedPct}%`, attention: budget.over },
            ]}
          />
        </div>
        <ShortcutsCard
          shortcuts={[
            { label: "Upload photo", icon: "add_a_photo", onClick: () => setSheet("photo") },
            { label: "Add expense", icon: "receipt_long", onClick: () => setSheet("expense") },
            { label: "Message client", icon: "chat_bubble", link: { to: "/projects/$projectId/chat", params } },
            { label: "Update stages", icon: "checklist", link: { to: "/projects/$projectId/stages", params } },
            { label: "Update rooms", icon: "floor", link: { to: "/projects/$projectId/plan", params } },
            { label: "Edit project", icon: "edit", onClick: () => setSheet("details") },
          ]}
        />
        <ClientCard
          projectId={projectId}
          clientName={project.client_name}
          contact={internal}
          appUsers={members.filter((m) => m.role === "client")}
          onEdit={() => setSheet("contact")}
        />
        <div className="min-w-0 lg:col-span-2">
          <TeamCard managers={members.filter((m) => m.role === "manager")} crew={crew} onAdd={() => setPerson("new")} onEdit={setPerson} />
        </div>
      </div>

      <ProjectDetailsSheet project={project} {...sheetProps("details")} />
      <ClientContactSheet projectId={projectId} contact={internal} {...sheetProps("contact")} />
      <UploadSheet projectId={projectId} stages={stages} rooms={rooms} {...sheetProps("photo")} />
      <ExpenseSheet projectId={projectId} stages={stages} expense={sheet === "expense" ? "new" : null} onClose={() => setSheet(null)} />
      <CrewSheet projectId={projectId} person={person} onClose={() => setPerson(null)} />
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
          <NativeSelect id="pd-schedule" value={form.schedule_status} onChange={(e) => set("schedule_status", e.target.value as ScheduleStatus)}>
            {(Object.keys(scheduleLabel) as ScheduleStatus[]).map((s) => <option key={s} value={s}>{scheduleLabel[s]}</option>)}
          </NativeSelect>
        </Field>
        <Field id="pd-note" label="Schedule note for the client">
          <Textarea id="pd-note" value={form.schedule_note ?? ""} onChange={(e) => set("schedule_note", e.target.value)} placeholder="Why the schedule is what it is, in plain words." />
        </Field>
        <Button type="submit" disabled={save.isPending} className="min-h-11 w-full">{save.isPending ? "Saving…" : "Save details"}</Button>
      </form>
    </FormSheet>
  );
}

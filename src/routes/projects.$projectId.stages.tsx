import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { StageCard, StageList } from "@/components/stage-card";
import { EmptyState } from "@/components/empty-state";
import { statusLabel, statuses, type Status } from "@/lib/status";
import { Field, FormSheet, selectCls, VisibleSwitch } from "@/components/manager/form-sheet";
import { PageHeader, PageLoading } from "@/components/page-header";
import { VisibilityBadge } from "@/components/manager/visibility-badge";
import { useAuth } from "@/lib/auth";
import { api, type StageInput } from "@/lib/api";
import { keys, useRooms, useSave, useStages } from "@/lib/queries";
import { shortDate, slugify } from "@/lib/format";
import type { Room, Stage, Task } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/stages")({
  head: () => ({
    meta: [
      { title: "Stages — RenoTrack" },
      { name: "description", content: "Edit renovation stages, dates, progress and task checklists." },
    ],
  }),
  component: StagesPage,
});

function StagesPage() {
  const { projectId } = Route.useParams();
  const isManager = useAuth().profile?.account_type === "manager";
  const { data: stages, isLoading } = useStages(projectId);
  const { data: rooms } = useRooms(projectId);
  const [editing, setEditing] = useState<Stage | "new" | null>(null);
  const inv = { invalidate: [keys.stages(projectId), keys.rooms(projectId)] };

  const saveTask = useSave(projectId, (t: Partial<Task> & { stage_id: string }) => api.saveTask(projectId, t), inv);
  const removeTask = useSave(projectId, (t: Task) => api.deleteTask(t.id), { ...inv, success: (t) => `Removed "${t.name}"` });
  const saveStage = useSave(projectId, (s: StageInput) => api.saveStage(projectId, s), { ...inv, success: "Stage saved" });

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (hash && stages) document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [stages]);

  if (isLoading || !stages) return <PageLoading />;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Renovation stages"
        description={isManager ? "Tick tasks as the crew finishes them. Clients see visible stages and tasks instantly." : "Every stage of your renovation and its checklist, updated by your site manager."}
        actions={isManager && <Button onClick={() => setEditing("new")} className="min-h-11 gap-2"><Plus className="h-4 w-4" /> Add stage</Button>}
      />

      {stages.length === 0 ? (
        <EmptyState className="mt-8" icon={ListChecks} title="No stages yet" text="Add the first stage — demolition, electrical, flooring — with its dates." />
      ) : (
        <StageList className="mt-8">
          {stages.map((s, i) => {
            const done = s.tasks.filter((t) => t.done).length;
            const fromChecklist = s.tasks.length ? Math.round((done / s.tasks.length) * 100) : null;
            return (
              <div key={s.id} id={s.id} className="scroll-mt-20">
                <StageCard
                  index={i + 1}
                  name={s.name}
                  start={shortDate(s.start_date)}
                  end={shortDate(s.end_date)}
                  status={s.status}
                  progress={s.progress}
                  dimmed={isManager && !s.is_visible}
                  tasks={s.tasks.map((t) => ({ ...t, muted: isManager && !t.is_visible }))}
                  onToggleTask={isManager ? (t) => saveTask.mutate({ id: t.id, stage_id: s.id, done: !t.done }) : undefined}
                  onRemoveTask={isManager ? (t) => removeTask.mutate(s.tasks.find((x) => x.id === t.id)!) : undefined}
                  headerExtra={isManager && (
                    <>
                      {!s.is_visible && <VisibilityBadge visible={false} />}
                      <Button variant="ghost" size="icon" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`} className="h-9 w-9"><Pencil className="h-4 w-4" /></Button>
                    </>
                  )}
                >
                  {isManager && <AddTask rooms={rooms ?? []} onAdd={(name, room_id) => saveTask.mutate({ stage_id: s.id, name, room_id, sort_order: s.tasks.length + 1 })} />}
                  {isManager && fromChecklist !== null && fromChecklist !== s.progress && s.status !== "done" && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                      <span>Checklist is {done}/{s.tasks.length} done ({fromChecklist}%). Progress shows {s.progress}%.</span>
                      <button
                        className="font-medium text-primary hover:underline"
                        onClick={() => {
                          const progress = Math.min(fromChecklist, 99);
                          saveStage.mutate({ id: s.id, progress, status: s.status === "pending" && progress > 0 ? "progress" : s.status });
                        }}
                      >
                        Use {Math.min(fromChecklist, 99)}%
                      </button>
                    </div>
                  )}
                  {s.client_note && <p className="mt-3 text-sm text-muted-foreground">{isManager ? "Note for client: " : ""}{s.client_note}</p>}
                </StageCard>
              </div>
            );
          })}
        </StageList>
      )}

      {isManager && <StageSheet projectId={projectId} stage={editing} rooms={rooms ?? []} count={stages.length} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AddTask({ rooms, onAdd }: { rooms: Room[]; onAdd: (name: string, roomId: string | null) => void }) {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name.trim(), roomId || null);
        setName("");
      }}
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a task…" aria-label="New task name" className="h-10" />
      <select value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="Room this task affects" className="h-10 w-32 shrink-0 rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <option value="">No room</option>
        {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <Button type="submit" variant="outline" disabled={!name.trim()} className="h-10">Add</Button>
    </form>
  );
}

type StageForm = Required<Pick<Stage, "name" | "status" | "progress" | "start_date" | "end_date" | "client_note" | "is_visible">>;

function StageSheet({ projectId, stage, rooms, count, onClose }: { projectId: string; stage: Stage | "new" | null; rooms: Room[]; count: number; onClose: () => void }) {
  const isNew = stage === "new";
  const [form, setForm] = useState<StageForm>({ name: "", status: "pending", progress: 0, start_date: "", end_date: "", client_note: "", is_visible: true });
  useEffect(() => {
    if (stage && stage !== "new") {
      const { name, status, progress, start_date, end_date, client_note, is_visible } = stage;
      setForm({ name, status, progress, start_date, end_date, client_note, is_visible });
    } else if (isNew) {
      setForm({ name: "", status: "pending", progress: 0, start_date: "", end_date: "", client_note: "", is_visible: true });
    }
  }, [stage, isNew]);
  const inv = { invalidate: [keys.stages(projectId)] };
  const save = useSave(projectId, (s: StageInput) => api.saveStage(projectId, s), { ...inv, success: "Stage saved — visible in the client app" });
  const remove = useSave(projectId, (id: string) => api.deleteStage(id), { ...inv, success: "Stage removed" });

  // "Completed" and 100% always go together (enforced by the database too).
  const setStatus = (status: Status) => setForm((f) => ({ ...f, status, progress: status === "done" ? 100 : f.progress === 100 ? 90 : f.progress }));
  const setProgress = (progress: number) =>
    setForm((f) => ({ ...f, progress, status: progress === 100 ? "done" : f.status === "done" ? "progress" : f.status === "pending" && progress > 0 ? "progress" : f.status }));
  const invalidDates = !!form.start_date && !!form.end_date && form.end_date < form.start_date;
  const roomNames = stage && stage !== "new" ? [...new Set(stage.tasks.map((t) => rooms.find((r) => r.id === t.room_id)?.name).filter(Boolean))] : [];

  return (
    <FormSheet open={stage !== null} onOpenChange={(v) => !v && onClose()} title={isNew ? "Add stage" : "Edit stage"} description="Dates, status and progress appear on the client's timeline.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const payload: StageInput = isNew ? { ...form, key: slugify(form.name), sort_order: count + 1 } : { ...form, id: (stage as Stage).id };
          save.mutate(payload, { onSuccess: onClose });
        }}
      >
        <Field id="st-name" label="Stage name"><Input id="st-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="st-start" label="Start"><Input id="st-start" type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="h-11" /></Field>
          <Field id="st-end" label="End"><Input id="st-end" type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="h-11" /></Field>
        </div>
        {invalidDates && <p className="text-sm text-destructive">End date must be on or after the start date.</p>}
        <Field id="st-status" label="Status">
          <select id="st-status" value={form.status} onChange={(e) => setStatus(e.target.value as Status)} className={selectCls}>
            {statuses.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
          </select>
        </Field>
        <Field id="st-progress" label={`Progress — ${form.progress}%`}>
          <Slider id="st-progress" min={0} max={100} step={5} value={[form.progress]} onValueChange={([v]) => setProgress(v)} className="py-3" />
        </Field>
        <Field id="st-note" label="Note for the client (optional)">
          <Textarea id="st-note" value={form.client_note} onChange={(e) => setForm({ ...form, client_note: e.target.value })} />
        </Field>
        <VisibleSwitch id="st-visible" checked={form.is_visible} onChange={(v) => setForm({ ...form, is_visible: v })} />
        {roomNames.length > 0 && <p className="text-xs text-muted-foreground">Tasks in this stage affect: {roomNames.join(", ")}.</p>}
        <Button type="submit" disabled={save.isPending || invalidDates || !form.name.trim()} className="min-h-11 w-full">{save.isPending ? "Saving…" : "Save stage"}</Button>
        {!isNew && stage && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full gap-2 text-destructive"
            onClick={() => confirm(`Delete "${stage.name}" and its ${stage.tasks.length} tasks?`) && remove.mutate(stage.id, { onSuccess: onClose })}
          >
            <Trash2 className="h-4 w-4" /> Delete stage
          </Button>
        )}
      </form>
    </FormSheet>
  );
}

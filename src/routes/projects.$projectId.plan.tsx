import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Map as MapIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { FloorPlan, RoomDetail } from "@/components/floor-plan";
import { RoomCard } from "@/components/room-card";
import { EmptyState } from "@/components/empty-state";
import { statusLabel, statuses, type Status } from "@/lib/status";
import { Field, FormSheet, selectCls, VisibleSwitch } from "@/components/manager/form-sheet";
import { PageHeader, PageLoading } from "@/components/page-header";
import { VisibilityBadge } from "@/components/manager/visibility-badge";
import { useAuth } from "@/lib/auth";
import { api, type RoomInput } from "@/lib/api";
import { keys, useRooms, useSave, useStages } from "@/lib/queries";
import { slugify } from "@/lib/format";
import type { Room } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/plan")({
  validateSearch: (s: Record<string, unknown>): { room?: string } => ({
    room: typeof s.room === "string" ? s.room : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Plan — RenoTrack" },
      { name: "description", content: "Update room status and progress on the floor plan." },
    ],
  }),
  component: PlanPage,
});

type RoomForm = Pick<Room, "name" | "status" | "progress" | "client_note" | "is_visible" | "x" | "y" | "w" | "h">;

function PlanPage() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const isManager = useAuth().profile?.account_type === "manager";
  const { data: rooms, isLoading } = useRooms(projectId);
  const { data: stages } = useStages(projectId);
  const [activeId, setActiveId] = useState<string | null>(search.room ?? null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!activeId && rooms?.length) setActiveId(rooms[0].id);
  }, [rooms, activeId]);

  if (isLoading || !rooms) return <PageLoading />;
  const active = rooms.find((r) => r.id === activeId) ?? null;
  const openTasks = (roomId: string) => (stages ?? []).flatMap((s) => s.tasks).filter((t) => t.room_id === roomId && !t.done);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Floor plan"
        description={isManager ? "Select a room to update what the client sees on their plan." : "Select a room to see its progress and what is happening there."}
        actions={isManager && <Button onClick={() => setAdding(true)} className="min-h-11 gap-2"><Plus className="h-4 w-4" /> Add room</Button>}
      />

      {rooms.length === 0 ? (
        <EmptyState className="mt-6" icon={MapIcon} title="No rooms yet" text="Add rooms with their position on the 600×420 plan grid." />
      ) : (
        <>
          <div className="mt-6">
            <FloorPlan
              rooms={rooms.map((r) => ({ ...r, muted: isManager && !r.is_visible }))}
              activeId={activeId}
              onSelect={(r) => setActiveId(r.id)}
              detail={
                !active ? undefined : isManager ? (
                  <RoomEditor key={active.id + active.status + active.progress} projectId={projectId} room={active} openTasks={openTasks(active.id).map((t) => t.name)} />
                ) : (
                  <RoomDetail room={active}>
                    {active.client_note && <p className="mt-5 text-sm text-muted-foreground">{active.client_note}</p>}
                    {openTasks(active.id).length > 0 && (
                      <div className="mt-5">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Still to do</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                          {openTasks(active.id).map((t) => <li key={t.id}>{t.name}</li>)}
                        </ul>
                      </div>
                    )}
                  </RoomDetail>
                )
              }
            />
          </div>

          <h2 className="mt-10 text-xl font-semibold">Rooms</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => (
              <RoomCard key={r.id} name={r.name} status={r.status} progress={r.progress} active={r.id === activeId} muted={isManager && !r.is_visible} onClick={() => setActiveId(r.id)}>
                {isManager && !r.is_visible && <div className="mt-2"><VisibilityBadge visible={false} /></div>}
              </RoomCard>
            ))}
          </div>
        </>
      )}

      {isManager && <FormSheet open={adding} onOpenChange={setAdding} title="Add room" description="Position is in plan units (600 wide × 420 high).">
        <RoomFields
          projectId={projectId}
          initial={{ name: "", status: "pending", progress: 0, client_note: "", is_visible: true, x: 20, y: 20, w: 160, h: 120 }}
          onSaved={() => setAdding(false)}
          extra={{ sort_order: rooms.length + 1 }}
          showGeometry
        />
      </FormSheet>}
    </div>
  );
}

function RoomEditor({ projectId, room, openTasks }: { projectId: string; room: Room; openTasks: string[] }) {
  const [geometry, setGeometry] = useState(false);
  const remove = useSave(projectId, (id: string) => api.deleteRoom(id), { invalidate: [keys.rooms(projectId), keys.stages(projectId)], success: "Room removed" });
  return (
    <>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Selected room</div>
      <h3 className="mt-1 text-xl font-semibold">{room.name}</h3>
      <div className="mt-4">
        <RoomFields projectId={projectId} initial={room} id={room.id} openTasks={openTasks} showGeometry={geometry} compact />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2">
        <button onClick={() => setGeometry((g) => !g)} className="text-xs text-primary hover:underline">{geometry ? "Hide" : "Edit"} position & size</button>
        <button
          onClick={() => confirm(`Delete ${room.name}? Photos and tasks keep existing without a room.`) && remove.mutate(room.id)}
          className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete room
        </button>
      </div>
    </>
  );
}

function RoomFields({
  projectId,
  initial,
  id,
  openTasks = [],
  showGeometry,
  compact,
  extra,
  onSaved,
}: {
  projectId: string;
  initial: RoomForm;
  id?: string;
  openTasks?: string[];
  showGeometry?: boolean;
  compact?: boolean;
  extra?: Partial<RoomInput>;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<RoomForm>({
    name: initial.name, status: initial.status, progress: initial.progress, client_note: initial.client_note,
    is_visible: initial.is_visible, x: initial.x, y: initial.y, w: initial.w, h: initial.h,
  });
  const save = useSave(projectId, (r: RoomInput) => api.saveRoom(projectId, r), {
    invalidate: [keys.rooms(projectId)],
    success: (r) => `${r.name} saved — the client's plan is updated`,
  });
  const setStatus = (status: Status) => setForm((f) => ({ ...f, status, progress: status === "done" ? 100 : f.progress === 100 ? 90 : f.progress }));
  const setProgress = (progress: number) => setForm((f) => ({ ...f, progress, status: progress === 100 ? "done" : f.status === "done" ? "progress" : f.status }));
  const blockedByTasks = form.status === "done" && openTasks.length > 0;
  const pre = id ?? "new";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ ...form, ...extra, ...(id ? { id } : { key: slugify(form.name) }) }, { onSuccess: () => onSaved?.() });
      }}
    >
      {!compact && <Field id={`${pre}-name`} label="Room name"><Input id={`${pre}-name`} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11" /></Field>}
      <Field id={`${pre}-status`} label="Status">
        <select id={`${pre}-status`} value={form.status} onChange={(e) => setStatus(e.target.value as Status)} className={selectCls}>
          {statuses.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
        </select>
      </Field>
      {blockedByTasks && (
        <p className="rounded-md bg-muted p-2 text-xs text-status-blocked" role="alert">
          Can't mark Completed while tasks are open: {openTasks.join(", ")}.
        </p>
      )}
      <Field id={`${pre}-progress`} label={`Progress — ${form.progress}%`}>
        <Slider id={`${pre}-progress`} min={0} max={100} step={5} value={[form.progress]} onValueChange={([v]) => setProgress(v)} className="py-3" />
      </Field>
      <Field id={`${pre}-note`} label="Note for the client">
        <Textarea id={`${pre}-note`} value={form.client_note} onChange={(e) => setForm({ ...form, client_note: e.target.value })} placeholder={form.status === "blocked" ? "What is it waiting on?" : "Optional"} />
      </Field>
      <VisibleSwitch id={`${pre}-visible`} checked={form.is_visible} onChange={(v) => setForm({ ...form, is_visible: v })} />
      {showGeometry && (
        <div className="grid grid-cols-4 gap-2">
          {(["x", "y", "w", "h"] as const).map((k) => (
            <Field key={k} id={`${pre}-${k}`} label={k.toUpperCase()}>
              <Input id={`${pre}-${k}`} type="number" min={k === "w" || k === "h" ? 10 : 0} max={k === "x" || k === "w" ? 600 : 420} value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} className="h-10 px-2" />
            </Field>
          ))}
        </div>
      )}
      <Button type="submit" disabled={save.isPending || blockedByTasks || !form.name.trim()} className="min-h-11 w-full">{save.isPending ? "Saving…" : id ? "Save room" : "Add room"}</Button>
    </form>
  );
}

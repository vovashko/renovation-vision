import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { FieldGroup } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FloorPlan } from "@/features/work/ui/floor-plan";
import { SelectedRoomPanel } from "@/features/work/ui/selected-room-panel";
import { RoomList } from "@/features/work/ui/room-list";
import { RoomsEmpty } from "@/features/work/ui/rooms-empty";
import { WorkField } from "@/features/work/ui/work-field";
import { statusLabel, statuses, type Status } from "@/lib/status";
import { progressForStatus, statusForProgress } from "@/lib/status-progress";
import { FormSheet, VisibleSwitch } from "@/shared/ui/form-sheet";
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
    meta: [{ title: "Plan — RenoVision" }, { name: "description", content: "Update room status and progress on the floor plan." }],
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
        description={
          isManager
            ? "Select a room to update what the client sees on their plan."
            : "Select a room to see its progress and what is happening there."
        }
        actions={
          isManager && (
            <Button onClick={() => setAdding(true)} className="min-h-11 gap-2">
              <Icon name="add" size={20} /> Add room
            </Button>
          )
        }
      />

      {rooms.length === 0 ? (
        <RoomsEmpty className="mt-6" />
      ) : (
        <>
          <div className="mt-6">
            <FloorPlan
              rooms={rooms.map((r) => ({ ...r, muted: isManager && !r.is_visible }))}
              activeId={activeId}
              onSelect={(r) => setActiveId(r.id)}
              detail={
                !active ? undefined : isManager ? (
                  <RoomEditor
                    key={active.id + active.status + active.progress}
                    projectId={projectId}
                    room={active}
                    openTasks={openTasks(active.id).map((t) => t.name)}
                  />
                ) : (
                  <SelectedRoomPanel room={active}>
                    {active.client_note && <p className="mt-5 text-body-md text-on-surface-variant">{active.client_note}</p>}
                    {openTasks(active.id).length > 0 && (
                      <div className="mt-5">
                        <div className="text-body-md text-on-surface-variant">Still to do</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-body-md">
                          {openTasks(active.id).map((t) => (
                            <li key={t.id}>{t.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </SelectedRoomPanel>
                )
              }
            />
          </div>

          <h2 className="mt-10 text-title-lg">Rooms</h2>
          <div className="mt-3">
            <RoomList
              rooms={rooms.map((r) => ({
                id: r.id,
                name: r.name,
                status: r.status,
                progress: r.progress,
                muted: isManager && !r.is_visible,
              }))}
              activeId={activeId}
              onSelect={(r) => setActiveId(r.id)}
              rowExtra={(r) =>
                isManager && r.muted ? (
                  <div className="mt-1">
                    <VisibilityBadge visible={false} />
                  </div>
                ) : null
              }
            />
          </div>
        </>
      )}

      {isManager && (
        <FormSheet open={adding} onOpenChange={setAdding} title="Add room" description="Position is in plan units (600 wide × 420 high).">
          <RoomFields
            projectId={projectId}
            initial={{ name: "", status: "pending", progress: 0, client_note: "", is_visible: true, x: 20, y: 20, w: 160, h: 120 }}
            onSaved={() => setAdding(false)}
            extra={{ sort_order: rooms.length + 1 }}
            showGeometry
          />
        </FormSheet>
      )}
    </div>
  );
}

function RoomEditor({ projectId, room, openTasks }: { projectId: string; room: Room; openTasks: string[] }) {
  const [geometry, setGeometry] = useState(false);
  const remove = useSave(projectId, (id: string) => api.deleteRoom(id), {
    invalidate: [keys.rooms(projectId), keys.stages(projectId)],
    success: "Room removed",
  });
  return (
    <>
      <div className="text-body-md text-on-surface-variant">Selected room</div>
      <h3 className="mt-1 text-title-lg">{room.name}</h3>
      <div className="mt-4">
        <RoomFields projectId={projectId} initial={room} id={room.id} openTasks={openTasks} showGeometry={geometry} compact />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2">
        <button type="button" onClick={() => setGeometry((g) => !g)} className="text-body-sm text-primary hover:underline">
          {geometry ? "Hide" : "Edit"} position & size
        </button>
        <button
          type="button"
          onClick={() => confirm(`Delete ${room.name}? Photos and tasks keep existing without a room.`) && remove.mutate(room.id)}
          className="inline-flex items-center gap-1 text-body-sm text-destructive hover:underline"
        >
          <Icon name="delete" size={16} /> Delete room
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
    name: initial.name,
    status: initial.status,
    progress: initial.progress,
    client_note: initial.client_note,
    is_visible: initial.is_visible,
    x: initial.x,
    y: initial.y,
    w: initial.w,
    h: initial.h,
  });
  const save = useSave(projectId, (r: RoomInput) => api.saveRoom(projectId, r), {
    invalidate: [keys.rooms(projectId)],
    success: (r) => `${r.name} saved — the client's plan is updated`,
  });
  const setStatus = (status: Status) => setForm((f) => ({ ...f, status, progress: progressForStatus(status, f.progress) }));
  const setProgress = (progress: number) => setForm((f) => ({ ...f, progress, status: statusForProgress(f.status, progress) }));
  const blockedByTasks = form.status === "done" && openTasks.length > 0;
  const pre = id ?? "new";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ ...form, ...extra, ...(id ? { id } : { key: slugify(form.name) }) }, { onSuccess: () => onSaved?.() });
      }}
    >
      <FieldGroup>
        {!compact && (
          <WorkField id={`${pre}-name`} label="Room name">
            <Input
              id={`${pre}-name`}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-11"
            />
          </WorkField>
        )}
        <WorkField id={`${pre}-status`} label="Status">
          <NativeSelect id={`${pre}-status`} value={form.status} onChange={(e) => setStatus(e.target.value as Status)}>
            {statuses.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {statusLabel[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </WorkField>
        {blockedByTasks && (
          <p className="rounded-md bg-status-blocked-container p-2 text-body-sm text-on-status-blocked-container" role="alert">
            Can't mark Completed while tasks are open: {openTasks.join(", ")}.
          </p>
        )}
        <WorkField id={`${pre}-progress`} label={`Progress — ${form.progress}%`}>
          <Slider
            id={`${pre}-progress`}
            min={0}
            max={100}
            step={5}
            value={[form.progress]}
            onValueChange={([v]) => setProgress(v)}
            className="py-3"
          />
        </WorkField>
        <WorkField id={`${pre}-note`} label="Note for the client">
          <Textarea
            id={`${pre}-note`}
            value={form.client_note}
            onChange={(e) => setForm({ ...form, client_note: e.target.value })}
            placeholder={form.status === "blocked" ? "What is it waiting on?" : "Optional"}
          />
        </WorkField>
        <VisibleSwitch id={`${pre}-visible`} checked={form.is_visible} onChange={(v) => setForm({ ...form, is_visible: v })} />
        {showGeometry && (
          <div className="grid grid-cols-4 gap-2">
            {(["x", "y", "w", "h"] as const).map((k) => (
              <WorkField key={k} id={`${pre}-${k}`} label={k.toUpperCase()}>
                <Input
                  id={`${pre}-${k}`}
                  type="number"
                  min={k === "w" || k === "h" ? 10 : 0}
                  max={k === "x" || k === "w" ? 600 : 420}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}
                  className="h-10 px-2"
                />
              </WorkField>
            ))}
          </div>
        )}
        <Button type="submit" disabled={save.isPending || blockedByTasks || !form.name.trim()} className="min-h-11 w-full">
          {save.isPending ? "Saving…" : id ? "Save room" : "Add room"}
        </Button>
      </FieldGroup>
    </form>
  );
}

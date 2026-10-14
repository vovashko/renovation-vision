// The only place in `features/work` that imports supabase-js (README → Architecture). Ported from
// `src/lib/api.ts` (read-only reference; not edited here — see the W2c task notes).
import { supabase } from "@/lib/supabase";
import type { Room, Stage, Task } from "@/lib/database.types";

export type StageInput = Partial<Omit<Stage, "tasks" | "project_id">>;
/** A task belongs to a stage and/or a room: pass `stage_id`, `room_id` or both when creating one. */
export type TaskInput = Partial<Omit<Task, "project_id">>;
export type RoomInput = Partial<Omit<Room, "project_id">>;

/** What deleting a room does to the rest of its data (room-form.tsx's confirm dialog). */
export type RoomDeleteImpact = {
  /** Lose the room link (SET NULL) but are not deleted. */
  staysPhotos: number;
  staysRenders: number;
  staysMaterials: number;
  staysDiaryEntries: number;
  /** Deleted with the room: room-only works (no stage) and the room's warnings. */
  deletesTasks: number;
  deletesWarnings: number;
};

type Result<T> = { data: T | null; error: { message: string } | null };

async function must<T>(p: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export const workRepo = {
  async listStages(projectId: string): Promise<Stage[]> {
    return must(
      supabase
        .from("stages")
        .select("*, tasks(*)")
        .eq("project_id", projectId)
        .order("sort_order")
        .order("sort_order", { referencedTable: "tasks" }),
    ) as Promise<Stage[]>;
  },
  async saveStage(projectId: string, { id: stageId, ...input }: StageInput): Promise<void> {
    if (stageId) await must(supabase.from("stages").update(input).eq("id", stageId));
    else await must(supabase.from("stages").insert({ ...input, project_id: projectId }));
  },
  async deleteStage(stageId: string): Promise<void> {
    await must(supabase.from("stages").delete().eq("id", stageId));
  },

  async saveTask(projectId: string, { id: taskId, ...input }: TaskInput): Promise<void> {
    if (taskId) await must(supabase.from("tasks").update(input).eq("id", taskId));
    else await must(supabase.from("tasks").insert({ ...input, project_id: projectId }));
  },
  async deleteTask(taskId: string): Promise<void> {
    await must(supabase.from("tasks").delete().eq("id", taskId));
  },

  async listRooms(projectId: string): Promise<Room[]> {
    return must(
      supabase.from("rooms").select("*").eq("project_id", projectId).order("sort_order").order("created_at"),
    ) as Promise<Room[]>;
  },
  async saveRoom(projectId: string, { id: roomId, ...input }: RoomInput): Promise<void> {
    if (roomId) await must(supabase.from("rooms").update(input).eq("id", roomId));
    else await must(supabase.from("rooms").insert({ ...input, project_id: projectId }));
  },
  async deleteRoom(roomId: string): Promise<void> {
    await must(supabase.from("rooms").delete().eq("id", roomId));
  },

  /** Counts for the room-delete confirm dialog: what stays unlinked vs. what is deleted with the room. */
  async roomDeleteImpact(roomId: string): Promise<RoomDeleteImpact> {
    const headCount = async (table: "photos" | "renders" | "materials" | "progress_entries" | "room_warnings") => {
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true }).eq("room_id", roomId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    };
    const [staysPhotos, staysRenders, staysMaterials, staysDiaryEntries, deletesTasks, deletesWarnings] = await Promise.all([
      headCount("photos"),
      headCount("renders"),
      headCount("materials"),
      headCount("progress_entries"),
      (async () => {
        const { count, error } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("room_id", roomId)
          .is("stage_id", null);
        if (error) throw new Error(error.message);
        return count ?? 0;
      })(),
      headCount("room_warnings"),
    ]);
    return { staysPhotos, staysRenders, staysMaterials, staysDiaryEntries, deletesTasks, deletesWarnings };
  },
};

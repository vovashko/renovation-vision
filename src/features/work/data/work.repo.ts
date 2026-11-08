// The only place in `features/work` that imports supabase-js (README → Architecture). Ported from
// `src/lib/api.ts` (read-only reference; not edited here — see the W2c task notes).
import { supabase } from "@/lib/supabase";
import type { Room, Stage, Task } from "@/lib/database.types";

export type StageInput = Partial<Omit<Stage, "tasks" | "project_id">> & {
  /** The stage's planned cost (`stage_budgets.planned_cost`), written separately from the stage row. */
  planned_cost?: number;
};
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
  /** Planned cost per stage id (managers only: clients have no policy on `stage_budgets`). */
  async listStageBudgets(projectId: string): Promise<Record<string, number>> {
    const rows = (await must(supabase.from("stage_budgets").select("stage_id, planned_cost").eq("project_id", projectId))) as
      { stage_id: string; planned_cost: number }[] | null;
    return Object.fromEntries((rows ?? []).map((r) => [r.stage_id, Number(r.planned_cost)]));
  },
  /**
   * Saves the stage, then its planned cost (a row in `stage_budgets`, which the database creates with the stage).
   * A missing `planned_cost` leaves the budget alone.
   */
  async saveStage(projectId: string, { id: stageId, planned_cost, ...input }: StageInput): Promise<void> {
    let id = stageId;
    if (id) {
      await must(supabase.from("stages").update(input).eq("id", id));
    } else {
      const created = (await must(
        supabase
          .from("stages")
          .insert({ ...input, project_id: projectId })
          .select("id")
          .single(),
      )) as { id: string } | null;
      id = created?.id;
    }
    if (id && planned_cost !== undefined) await must(supabase.from("stage_budgets").update({ planned_cost }).eq("stage_id", id));
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
    return must(supabase.from("rooms").select("*").eq("project_id", projectId).order("sort_order").order("created_at")) as Promise<Room[]>;
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

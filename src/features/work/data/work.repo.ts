// The only place in `features/work` that imports supabase-js (README → Architecture). Ported from
// `src/lib/api.ts` (read-only reference; not edited here — see the W2c task notes).
import { supabase } from "@/lib/supabase";
import type { ProjectSummary, Room, Stage, Task } from "@/lib/database.types";

export type StageInput = Partial<Omit<Stage, "tasks" | "project_id">>;
export type TaskInput = Partial<Omit<Task, "project_id">> & { stage_id: string };
export type RoomInput = Partial<Omit<Room, "project_id">>;

type Result<T> = { data: T | null; error: { message: string } | null };

async function must<T>(p: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

const toNumber = <T extends Record<string, unknown>>(row: T, ...fields: (keyof T)[]) => {
  for (const f of fields) (row as Record<string, unknown>)[f as string] = Number(row[f]);
  return row;
};

export const workRepo = {
  /** The project_summary view row — the "projects" feature owns this table; work's overview needs it too. */
  async getProject(id: string): Promise<ProjectSummary> {
    const row = await must(supabase.from("project_summary").select("*").eq("id", id).single());
    return toNumber(row as unknown as ProjectSummary, "budget", "spent");
  },

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
    return must(supabase.from("rooms").select("*").eq("project_id", projectId).order("sort_order")) as Promise<Room[]>;
  },
  async saveRoom(projectId: string, { id: roomId, ...input }: RoomInput): Promise<void> {
    if (roomId) await must(supabase.from("rooms").update(input).eq("id", roomId));
    else await must(supabase.from("rooms").insert({ ...input, project_id: projectId }));
  },
  async deleteRoom(roomId: string): Promise<void> {
    await must(supabase.from("rooms").delete().eq("id", roomId));
  },
};

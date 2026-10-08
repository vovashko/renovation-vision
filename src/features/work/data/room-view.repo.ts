// The room view's data (issue #56): a room's works (tasks), materials and investor warnings. Part of the work
// feature's data layer, so it is the only code here that imports supabase-js (README → Architecture).
//
// Materials are read through `room_materials(room)`, a security-definer function that returns no prices,
// supplier or notes, because clients can't read the `materials` table. Managers write the table directly.
import { supabase } from "@/lib/supabase";
import type { MaterialStatus, RoomMaterial, RoomWarning, Task } from "@/lib/database.types";

type Result<T> = { data: T | null; error: { message: string } | null };

async function must<T>(p: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export type RoomMaterialInput = {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  status: MaterialStatus;
  /** `YYYY-MM-DD`, or null for "not set". */
  order_by_date: string | null;
  delivery_date: string | null;
};

export type RoomWarningInput = { id?: string; text: string; material_ids: string[] };

export const roomViewRepo = {
  /** The tasks that belong to a room (with or without a stage), in checklist order. */
  async listRoomTasks(roomId: string): Promise<Task[]> {
    return must(supabase.from("tasks").select("*").eq("room_id", roomId).order("sort_order").order("created_at")) as Promise<Task[]>;
  },

  async listRoomMaterials(roomId: string): Promise<RoomMaterial[]> {
    return must(supabase.rpc("room_materials", { p_room: roomId })) as Promise<RoomMaterial[]>;
  },
  async saveMaterial(projectId: string, roomId: string, { id: materialId, ...input }: RoomMaterialInput): Promise<void> {
    if (materialId) await must(supabase.from("materials").update(input).eq("id", materialId));
    else await must(supabase.from("materials").insert({ ...input, project_id: projectId, room_id: roomId }));
  },
  async deleteMaterial(materialId: string): Promise<void> {
    await must(supabase.from("materials").delete().eq("id", materialId));
  },

  /** A room's warnings with the ids of their linked materials (clients receive only the open ones: RLS). */
  async listRoomWarnings(roomId: string): Promise<RoomWarning[]> {
    const rows = await must(
      supabase
        .from("room_warnings")
        .select("id, project_id, room_id, text, created_by, created_at, room_warning_materials(material_id)")
        .eq("room_id", roomId)
        .order("created_at"),
    );
    return (rows ?? []).map(({ room_warning_materials, ...warning }) => ({
      ...warning,
      material_ids: (room_warning_materials ?? []).map((l) => l.material_id),
    }));
  },
  async saveWarning(projectId: string, roomId: string, { id: warningId, text, material_ids }: RoomWarningInput): Promise<void> {
    let id = warningId;
    if (id) {
      await must(supabase.from("room_warnings").update({ text }).eq("id", id));
    } else {
      const created = (await must(
        supabase.from("room_warnings").insert({ text, project_id: projectId, room_id: roomId }).select("id").single(),
      )) as { id: string } | null;
      if (!created) throw new Error("The warning was not created");
      id = created.id;
    }
    const current = warningId
      ? (await must(supabase.from("room_warning_materials").select("material_id").eq("warning_id", id))).map((l) => l.material_id)
      : [];
    const removed = current.filter((m) => !material_ids.includes(m));
    const added = material_ids.filter((m) => !current.includes(m));
    if (removed.length) await must(supabase.from("room_warning_materials").delete().eq("warning_id", id).in("material_id", removed));
    if (added.length) {
      await must(supabase.from("room_warning_materials").insert(added.map((material_id) => ({ warning_id: id, material_id }))));
    }
  },
  async deleteWarning(warningId: string): Promise<void> {
    await must(supabase.from("room_warnings").delete().eq("id", warningId));
  },
};

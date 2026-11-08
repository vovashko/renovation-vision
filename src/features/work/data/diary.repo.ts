// The site diary's data (T43): `progress_entries` and the link from a project's materials to an entry. Part of the
// work feature's data layer, so it is one of the few places here that imports supabase-js. Photos are linked by the
// media feature (`photos.progress_entry_id`).
//
// Clients read only visible entries (RLS); materials are manager-only (clients have no policy on the table).
import { supabase } from "@/lib/supabase";
import type { ProgressEntry } from "@/lib/database.types";

type Result<T> = { data: T | null; error: { message: string } | null };

async function must<T>(p: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

const ENTRY_COLUMNS = "id, project_id, stage_id, room_id, entry_date, author_id, note, hours, is_visible, created_at, updated_at";

export type DiaryEntryInput = {
  id?: string;
  note: string;
  /** `YYYY-MM-DD`. */
  entry_date: string;
  stage_id: string | null;
  room_id: string | null;
  hours: number | null;
  is_visible: boolean;
};

/** A project material as the diary's picker and entry cards need it. */
export type DiaryMaterial = { id: string; name: string; quantity: number; unit: string; progress_entry_id: string | null };

export const diaryRepo = {
  /** A project's diary, newest first. */
  async listEntries(projectId: string): Promise<ProgressEntry[]> {
    return must(
      supabase
        .from("progress_entries")
        .select(ENTRY_COLUMNS)
        .eq("project_id", projectId)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ) as Promise<ProgressEntry[]>;
  },

  /** Creates or updates an entry and returns its id. The author is the signed-in user (column default). */
  async saveEntry(projectId: string, { id, ...input }: DiaryEntryInput): Promise<string> {
    if (id) {
      await must(supabase.from("progress_entries").update(input).eq("id", id));
      return id;
    }
    const created = (await must(
      supabase
        .from("progress_entries")
        .insert({ ...input, project_id: projectId })
        .select("id")
        .single(),
    )) as { id: string } | null;
    if (!created) throw new Error("The diary entry was not created");
    return created.id;
  },

  async deleteEntry(entryId: string): Promise<void> {
    await must(supabase.from("progress_entries").delete().eq("id", entryId));
  },

  /** The project's materials (managers only), to pick the ones used and to name the ones linked to an entry. */
  async listMaterials(projectId: string): Promise<DiaryMaterial[]> {
    return must(
      supabase.from("materials").select("id, name, quantity, unit, progress_entry_id").eq("project_id", projectId).order("name"),
    ) as Promise<DiaryMaterial[]>;
  },

  /** Makes `materialIds` the materials used by the entry: links the new ones and unlinks the ones taken off. */
  async setEntryMaterials(entryId: string, materialIds: string[], previousIds: string[]): Promise<void> {
    const removed = previousIds.filter((id) => !materialIds.includes(id));
    const added = materialIds.filter((id) => !previousIds.includes(id));
    if (removed.length) await must(supabase.from("materials").update({ progress_entry_id: null }).in("id", removed));
    if (added.length) await must(supabase.from("materials").update({ progress_entry_id: entryId }).in("id", added));
  },
};

// The only module in features/decisions that imports supabase-js. Reads are plain selects (RLS: the
// project's managers and clients). Every change is an RPC: the database owns the state machine, the history
// and the notifications (supabase/migrations/…investor_decisions.sql). Submitting a case and accepting one
// go through server functions instead (the investor email, the confirmation code), see ../hooks.
//
// Storage: photos live in `project-media` at `<project_id>/decisions/<uuid>.<ext>` (the folder the storage
// policies and the table's check key on). Files are re-encoded / EXIF-stripped by the hook before they get here.
import { supabase, MEDIA_BUCKET } from "@/lib/supabase";
import { fileExt } from "@/domain/text";
import type { Decision, DecisionEvent, DecisionPhoto } from "@/lib/database.types";

/** An error from the database; `hint` is the machine-readable code an RPC raised (e.g. `decision_locked`). */
export class DecisionRepoError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}

type Result<T> = { data: T | null; error: { message: string; hint?: string | null } | null };

async function must<T>(p: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new DecisionRepoError(error.message, error.hint ?? undefined);
  return data as T;
}

export type DecisionInput = { title: string; description: string; cost_delta: number; days_delta: number };

type DecisionRow = Omit<Decision, "photos" | "cost_delta"> & {
  cost_delta: number | string;
  photos: Omit<DecisionPhoto, "url">[];
};

const SELECT = "*, photos:decision_photos(id, decision_id, storage_path, sort_order)";

/** Signed URLs for storage paths, keyed by path; a path that can't be signed is left out. */
async function signUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map();
  const data = await must(supabase.storage.from(MEDIA_BUCKET).createSignedUrls(unique, 60 * 60));
  return new Map(data.filter((d) => d.signedUrl).map((d) => [d.path as string, d.signedUrl as string]));
}

/** `numeric` may arrive as a string; the app always wants a number. */
export function mapDecision(row: DecisionRow, urls: Map<string, string>): Decision {
  return {
    ...row,
    cost_delta: Number(row.cost_delta),
    photos: [...row.photos].sort((a, b) => a.sort_order - b.sort_order).map((p) => ({ ...p, url: urls.get(p.storage_path) ?? "" })),
  };
}

/** `<project_id>/decisions/<uuid>.<ext>` */
export const decisionPhotoPath = (projectId: string, file: File) => `${projectId}/decisions/${crypto.randomUUID()}.${fileExt(file.name)}`;

export const decisionsRepo = {
  async list(projectId: string): Promise<Decision[]> {
    const rows = (await must(
      supabase.from("decisions").select(SELECT).eq("project_id", projectId).order("created_at", { ascending: false }),
    )) as unknown as DecisionRow[];
    const urls = await signUrls(rows.flatMap((r) => r.photos.map((p) => p.storage_path)));
    return rows.map((r) => mapDecision(r, urls));
  },

  /** How many cases await the investor's decision (the navigation badge); no rows are fetched. */
  async countPending(projectId: string): Promise<number> {
    const { count, error } = await supabase
      .from("decisions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "pending");
    if (error) throw new DecisionRepoError(error.message, error.hint ?? undefined);
    return count ?? 0;
  },

  async events(decisionId: string): Promise<DecisionEvent[]> {
    return (await must(
      supabase
        .from("decision_events")
        .select("id, decision_id, kind, actor_id, actor_role, text, created_at")
        .eq("decision_id", decisionId)
        .order("id", { ascending: true }),
    )) as DecisionEvent[];
  },

  /** Uploads already-processed files and returns their storage paths. Removes what it uploaded if one upload fails. */
  async uploadPhotos(projectId: string, files: File[]): Promise<string[]> {
    const uploaded: string[] = [];
    try {
      for (const file of files) {
        const path = decisionPhotoPath(projectId, file);
        await must(supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false }));
        uploaded.push(path);
      }
    } catch (e) {
      await this.removeObjects(uploaded);
      throw e;
    }
    return uploaded;
  },

  /** Best effort: an object that can't be removed is only an orphan in storage. */
  async removeObjects(paths: string[]): Promise<void> {
    if (!paths.length) return;
    await supabase.storage.from(MEDIA_BUCKET).remove(paths);
  },

  /** Saves an edit while the case is open; returns the storage paths of the photos it removed. */
  async update(decisionId: string, input: DecisionInput, addPaths: string[], removePhotoIds: string[]): Promise<string[]> {
    return must(
      supabase.rpc("update_decision", {
        p_decision: decisionId,
        p_title: input.title,
        p_description: input.description,
        p_cost_delta: input.cost_delta,
        p_days_delta: input.days_delta,
        p_add_photos: addPaths,
        p_remove_photos: removePhotoIds,
      }),
    );
  },

  async ask(decisionId: string, text: string): Promise<void> {
    await must(supabase.rpc("ask_decision_question", { p_decision: decisionId, p_text: text }));
  },

  async answer(decisionId: string, text: string): Promise<void> {
    await must(supabase.rpc("answer_decision_question", { p_decision: decisionId, p_text: text }));
  },

  async reject(decisionId: string, reason: string): Promise<void> {
    await must(supabase.rpc("reject_decision", { p_decision: decisionId, p_reason: reason }));
  },

  async reopen(decisionId: string): Promise<void> {
    await must(supabase.rpc("reopen_decision", { p_decision: decisionId }));
  },
};

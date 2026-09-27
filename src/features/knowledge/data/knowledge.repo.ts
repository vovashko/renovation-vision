import { supabase } from "@/lib/supabase";
import type { Knowledge } from "@/lib/database.types";

export type KnowledgeInput = Partial<Omit<Knowledge, "project_id" | "updated_at">>;

type Result<T> = { data: T | null; error: { message: string } | null };

async function must<T>(p: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

function sb() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

async function currentUserId() {
  const { data } = await sb().auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

/** AI knowledge entries (`ai_knowledge`): manager-curated facts the client assistant may use. */
export const knowledgeRepo = {
  async list(projectId: string): Promise<Knowledge[]> {
    return must(sb().from("ai_knowledge").select("*").eq("project_id", projectId).order("created_at")) as Promise<Knowledge[]>;
  },
  async save(projectId: string, { id, ...input }: KnowledgeInput): Promise<void> {
    if (id) await must(sb().from("ai_knowledge").update(input).eq("id", id));
    else
      await must(
        sb()
          .from("ai_knowledge")
          .insert({ ...input, project_id: projectId, created_by: await currentUserId() }),
      );
  },
  async remove(knowledgeId: string): Promise<void> {
    await must(sb().from("ai_knowledge").delete().eq("id", knowledgeId));
  },
};

// The only file in `features/people` that talks to Supabase. Ported from `src/lib/api.ts`
// (listMembers/addMember/removeMember, listCrew/saveCrew/deleteCrew).
import { supabase } from "@/lib/supabase";
import type { CrewMember, Member, ProjectRole } from "@/lib/database.types";

export type CrewInput = Partial<Omit<CrewMember, "project_id">>;

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

export const peopleRepo = {
  async listMembers(projectId: string): Promise<Member[]> {
    return must(
      sb().from("project_members").select("*, profile:profiles(id, full_name, avatar_url)").eq("project_id", projectId).order("created_at"),
    ) as Promise<Member[]>;
  },

  async addMember(projectId: string, email: string, role: ProjectRole): Promise<void> {
    await must(sb().rpc("add_project_member", { p_project: projectId, p_email: email, p_role: role }));
  },

  async removeMember(projectId: string, userId: string): Promise<void> {
    await must(sb().from("project_members").delete().eq("project_id", projectId).eq("user_id", userId));
  },

  async listCrew(projectId: string): Promise<CrewMember[]> {
    return must(sb().from("project_crew").select("*").eq("project_id", projectId).order("sort_order").order("created_at")) as Promise<
      CrewMember[]
    >;
  },

  async saveCrew(projectId: string, { id: crewId, ...input }: CrewInput): Promise<void> {
    if (crewId) await must(sb().from("project_crew").update(input).eq("id", crewId));
    else
      await must(
        sb()
          .from("project_crew")
          .insert({ ...input, project_id: projectId }),
      );
  },

  async deleteCrew(crewId: string): Promise<void> {
    await must(sb().from("project_crew").delete().eq("id", crewId));
  },
};

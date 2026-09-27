// The only file in `features/projects` that talks to Supabase. Ported from `src/lib/api.ts`
// (listProjects, createProject, getProject, updateProject, getInternal/updateClientContact).
import { supabase } from "@/lib/supabase";
import type { Project, ProjectInternal, ProjectSummary } from "@/lib/database.types";

export type ProjectPatch = Partial<
  Pick<Project, "name" | "address" | "client_name" | "start_date" | "target_date" | "budget" | "schedule_status" | "schedule_note">
>;

export type NewProject = {
  name: string;
  address: string;
  client_name: string;
  start_date: string | null;
  target_date: string | null;
  budget: number;
};

export type ClientContact = Pick<ProjectInternal, "client_phone" | "client_email">;

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

/** The generated view marks every numeric column nullable/text; the client always wants a number. */
const toNumber = <T extends Record<string, unknown>>(row: T, ...keys: (keyof T)[]) => {
  for (const k of keys) (row as Record<string, unknown>)[k as string] = Number(row[k]);
  return row;
};

export const projectsRepo = {
  async listProjects(): Promise<ProjectSummary[]> {
    const rows = await must(sb().from("project_summary").select("*").order("name"));
    return (rows as ProjectSummary[]).map((r) => toNumber(r, "budget", "spent"));
  },

  async getProject(id: string): Promise<ProjectSummary> {
    const row = await must(sb().from("project_summary").select("*").eq("id", id).single());
    return toNumber(row as unknown as ProjectSummary, "budget", "spent");
  },

  async createProject(input: NewProject): Promise<string> {
    return must(
      sb().rpc("create_project", {
        p_name: input.name,
        p_address: input.address,
        p_client_name: input.client_name,
        p_start_date: input.start_date,
        p_target_date: input.target_date,
        p_budget: input.budget,
      }),
    ) as Promise<string>;
  },

  async updateProject(id: string, patch: ProjectPatch): Promise<void> {
    await must(sb().from("projects").update(patch).eq("id", id));
  },

  async getClientContact(id: string): Promise<ClientContact> {
    return must(sb().from("project_internal").select("client_phone, client_email").eq("project_id", id).single()) as Promise<ClientContact>;
  },

  async updateClientContact(id: string, contact: ClientContact): Promise<void> {
    await must(
      sb()
        .from("project_internal")
        .upsert({ project_id: id, ...contact }),
    );
  },
};

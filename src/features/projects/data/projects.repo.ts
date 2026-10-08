// The only file in `features/projects` that talks to Supabase. Ported from `src/lib/api.ts`
// (listProjects, createProject, getProject, updateProject). The client's contact details moved to
// `contacts` (T30) and belong to `features/people`.
import { supabase } from "@/lib/supabase";
import type { Project, ProjectSummary } from "@/lib/database.types";

export type ProjectPatch = Partial<
  Pick<
    Project,
    | "name"
    | "address_line"
    | "postal_code"
    | "city"
    | "country"
    | "currency"
    | "status"
    | "start_date"
    | "target_date"
    | "budget"
    | "planned_target_date"
    | "planned_budget"
    | "schedule_status"
    | "schedule_note"
  >
>;

export type NewProject = Pick<Project, "name" | "address_line" | "postal_code" | "city" | "country" | "currency" | "status" | "budget"> & {
  /** Becomes the project's primary client contact when not empty. */
  client_name: string;
  start_date: string | null;
  target_date: string | null;
};

type Result<T> = { data: T | null; error: { message: string; hint?: string | null } | null };

/** An error from the database; `hint` is the machine-readable code a trigger raised (e.g. `baseline_locked`). */
export class RepoError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}

async function must<T>(p: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new RepoError(error.message, error.hint ?? undefined);
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
    return (rows as ProjectSummary[]).map((r) => toNumber(r, "budget", "planned_budget", "spent"));
  },

  async getProject(id: string): Promise<ProjectSummary> {
    const row = await must(sb().from("project_summary").select("*").eq("id", id).single());
    return toNumber(row as unknown as ProjectSummary, "budget", "planned_budget", "spent");
  },

  async createProject(input: NewProject): Promise<string> {
    return must(
      sb().rpc("create_project", {
        p_name: input.name,
        p_address_line: input.address_line,
        p_postal_code: input.postal_code,
        p_city: input.city,
        p_country: input.country,
        p_currency: input.currency,
        p_status: input.status,
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
};

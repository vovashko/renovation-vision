import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));

import { supabase } from "@/lib/supabase";
import { projectsRepo } from "@/features/projects/data/projects.repo";

function makeChain(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "update", "single"]) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => void) => resolve(result);
  return chain as Record<"select" | "eq" | "order" | "update" | "single", ReturnType<typeof vi.fn>>;
}

beforeEach(() => {
  vi.mocked(supabase.from).mockReset();
  vi.mocked(supabase.rpc).mockReset();
});

describe("projectsRepo.createProject", () => {
  it("passes the structured address, currency, status and client name to create_project", async () => {
    vi.mocked(supabase.rpc).mockReturnValue(makeChain({ data: "p9", error: null }) as never);

    const id = await projectsRepo.createProject({
      name: "Elm Road House",
      address_line: "ul. Długa 5/3",
      postal_code: "00-238",
      city: "Warszawa",
      country: "PL",
      currency: "EUR",
      status: "planning",
      client_name: "Ola Nowak",
      start_date: null,
      target_date: "2026-12-01",
      budget: 120000,
    });

    expect(id).toBe("p9");
    expect(supabase.rpc).toHaveBeenCalledWith("create_project", {
      p_name: "Elm Road House",
      p_address_line: "ul. Długa 5/3",
      p_postal_code: "00-238",
      p_city: "Warszawa",
      p_country: "PL",
      p_currency: "EUR",
      p_status: "planning",
      p_client_name: "Ola Nowak",
      p_start_date: null,
      p_target_date: "2026-12-01",
      p_budget: 120000,
    });
  });

  it("throws the RPC's error message", async () => {
    vi.mocked(supabase.rpc).mockReturnValue(makeChain({ data: null, error: { message: "Only manager or admin accounts" } }) as never);
    await expect(
      projectsRepo.createProject({
        name: "x",
        address_line: "",
        postal_code: "",
        city: "",
        country: "PL",
        currency: "PLN",
        status: "active",
        client_name: "",
        start_date: null,
        target_date: null,
        budget: 0,
      }),
    ).rejects.toThrow("Only manager or admin accounts");
  });
});

describe("projectsRepo.getProject / updateProject", () => {
  it("reads project_summary and turns the money columns into numbers", async () => {
    const chain = makeChain({ data: { id: "p1", budget: "84500.00", spent: "51200.00", currency: "PLN" }, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);
    const project = await projectsRepo.getProject("p1");
    expect(supabase.from).toHaveBeenCalledWith("project_summary");
    expect(project).toMatchObject({ budget: 84500, spent: 51200, currency: "PLN" });
  });

  it("updates the editable columns, never the generated address", async () => {
    const chain = makeChain({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);
    const patch = { address_line: "1 New St", postal_code: "00-001", city: "Warszawa", currency: "EUR", status: "on_hold" as const };
    await projectsRepo.updateProject("p1", patch);
    expect(supabase.from).toHaveBeenCalledWith("projects");
    expect(chain.update).toHaveBeenCalledWith(patch);
    expect(chain.eq).toHaveBeenCalledWith("id", "p1");
  });
});

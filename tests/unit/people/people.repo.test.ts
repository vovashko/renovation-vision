import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));

import { supabase } from "@/lib/supabase";
import { peopleRepo } from "@/features/people/data/people.repo";

type Chain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => void) => void;
};

/** A minimal thenable query-builder stand-in: every method returns itself, `await` resolves `result`. */
function makeChain(result: { data: unknown; error: { message: string } | null }): Chain {
  const chain = {} as Chain;
  for (const method of ["select", "eq", "order", "update", "insert", "delete"] as const) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve) => resolve(result);
  return chain;
}

const member = {
  project_id: "p1",
  user_id: "u1",
  role: "manager" as const,
  last_read_at: null,
  created_at: "2026-01-01T00:00:00Z",
  profile: { id: "u1", full_name: "Jonas", avatar_url: null },
};

beforeEach(() => {
  vi.mocked(supabase.from).mockReset();
  vi.mocked(supabase.rpc).mockReset();
});

describe("peopleRepo.listMembers", () => {
  it("selects project_members with the joined profile, ordered by created_at", async () => {
    const chain = makeChain({ data: [member], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await peopleRepo.listMembers("p1");

    expect(supabase.from).toHaveBeenCalledWith("project_members");
    expect(chain.select).toHaveBeenCalledWith("*, profile:profiles(id, full_name, avatar_url)");
    expect(chain.eq).toHaveBeenCalledWith("project_id", "p1");
    expect(chain.order).toHaveBeenCalledWith("created_at");
    expect(result).toEqual([member]);
  });

  it("throws the Postgres error message", async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: null, error: { message: "boom" } }) as never);
    await expect(peopleRepo.listMembers("p1")).rejects.toThrow("boom");
  });
});

describe("peopleRepo.addMember / removeMember", () => {
  it("calls the add_project_member RPC", async () => {
    vi.mocked(supabase.rpc).mockReturnValue(makeChain({ data: "u2", error: null }) as never);
    await peopleRepo.addMember("p1", "new@example.com", "client");
    expect(supabase.rpc).toHaveBeenCalledWith("add_project_member", { p_project: "p1", p_email: "new@example.com", p_role: "client" });
  });

  it("deletes the member row by project and user id", async () => {
    const chain = makeChain({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);
    await peopleRepo.removeMember("p1", "u1");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("project_id", "p1");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "u1");
  });
});

describe("peopleRepo.saveCrew", () => {
  it("inserts a new crew member under the project", async () => {
    const chain = makeChain({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);
    await peopleRepo.saveCrew("p1", { name: "Alex", trade: "Electrician", phone: "", email: "" });
    expect(chain.insert).toHaveBeenCalledWith({ name: "Alex", trade: "Electrician", phone: "", email: "", project_id: "p1" });
  });

  it("updates an existing crew member by id", async () => {
    const chain = makeChain({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);
    await peopleRepo.saveCrew("p1", { id: "c1", name: "Alex" });
    expect(chain.update).toHaveBeenCalledWith({ name: "Alex" });
    expect(chain.eq).toHaveBeenCalledWith("id", "c1");
  });
});

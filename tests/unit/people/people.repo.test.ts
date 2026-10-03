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
  single: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => void) => void;
};

/** A minimal thenable query-builder stand-in: every method returns itself, `await` resolves `result`. */
function makeChain(result: { data: unknown; error: { message: string } | null }): Chain {
  const chain = {} as Chain;
  for (const method of ["select", "eq", "order", "update", "insert", "delete", "single"] as const) {
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

const contact = {
  id: "c1",
  kind: "crew" as const,
  full_name: "Marek Nowak",
  company: null,
  trade: "Site lead",
  phone: "+1 555 0107",
  whatsapp: null,
  email: "marek@example.com",
  notes: null,
  user_id: null,
};
const link = {
  id: "l1",
  project_id: "p1",
  contact_id: "c1",
  role: "crew" as const,
  is_primary: false,
  visible_to_client: false,
  sort_order: 1,
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

describe("peopleRepo.listProjectContacts", () => {
  it("selects the project's links with the joined contact, in sort order", async () => {
    const chain = makeChain({ data: [{ ...link, contact }], error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await peopleRepo.listProjectContacts("p1");

    expect(supabase.from).toHaveBeenCalledWith("project_contacts");
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining("contact:contacts(id, kind, full_name"));
    expect(chain.eq).toHaveBeenCalledWith("project_id", "p1");
    expect(chain.order).toHaveBeenCalledWith("sort_order");
    expect(result).toEqual([{ ...link, contact }]);
  });

  it("drops links whose contact RLS hides", async () => {
    vi.mocked(supabase.from).mockReturnValue(makeChain({ data: [{ ...link, contact: null }], error: null }) as never);
    expect(await peopleRepo.listProjectContacts("p1")).toEqual([]);
  });
});

describe("peopleRepo.addProjectContact", () => {
  it("creates the contact, then links it to the project", async () => {
    const contactsChain = makeChain({ data: { id: "c9" }, error: null });
    const linksChain = makeChain({ data: null, error: null });
    vi.mocked(supabase.from).mockImplementation(((table: string) => (table === "contacts" ? contactsChain : linksChain)) as never);

    await peopleRepo.addProjectContact("p1", {
      kind: "crew",
      role: "crew",
      fields: { full_name: "Alex", trade: "Tiler", phone: null, email: null },
      sortOrder: 5,
    });

    expect(contactsChain.insert).toHaveBeenCalledWith({ kind: "crew", full_name: "Alex", trade: "Tiler", phone: null, email: null });
    expect(contactsChain.select).toHaveBeenCalledWith("id");
    expect(linksChain.insert).toHaveBeenCalledWith({
      project_id: "p1",
      contact_id: "c9",
      role: "crew",
      sort_order: 5,
      is_primary: false,
      visible_to_client: false,
    });
  });

  it("doesn't link when the contact couldn't be created", async () => {
    const contactsChain = makeChain({ data: null, error: { message: "denied" } });
    const linksChain = makeChain({ data: null, error: null });
    vi.mocked(supabase.from).mockImplementation(((table: string) => (table === "contacts" ? contactsChain : linksChain)) as never);
    await expect(peopleRepo.addProjectContact("p1", { kind: "client", role: "client", fields: { full_name: "X" } })).rejects.toThrow(
      "denied",
    );
    expect(linksChain.insert).not.toHaveBeenCalled();
  });
});

describe("peopleRepo.updateContact / unlinkProjectContact", () => {
  it("updates the address-book entry by id", async () => {
    const chain = makeChain({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);
    await peopleRepo.updateContact("c1", { phone: "+48 600 100 200" });
    expect(supabase.from).toHaveBeenCalledWith("contacts");
    expect(chain.update).toHaveBeenCalledWith({ phone: "+48 600 100 200" });
    expect(chain.eq).toHaveBeenCalledWith("id", "c1");
  });

  it("unlinks by deleting the project_contacts row only", async () => {
    const chain = makeChain({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);
    await peopleRepo.unlinkProjectContact("l1");
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith("project_contacts");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("id", "l1");
  });
});

describe("peopleRepo.listVisibleContacts", () => {
  it("calls the project_visible_contacts RPC", async () => {
    const rows = [{ role: "poc", full_name: "Jonas Weber", phone: null, email: "jonas@renovision.demo", is_primary: true }];
    vi.mocked(supabase.rpc).mockReturnValue(makeChain({ data: rows, error: null }) as never);
    expect(await peopleRepo.listVisibleContacts("p1")).toEqual(rows);
    expect(supabase.rpc).toHaveBeenCalledWith("project_visible_contacts", { p_project: "p1" });
  });
});

import { describe, it, expect } from "vitest";
import { clientAccessStatus } from "@/features/people/domain/client-access";
import type { Member, ProjectContact } from "@/lib/database.types";

const client = (email: string | null, user_id: string | null): ProjectContact => ({
  id: "l1",
  project_id: "p1",
  contact_id: "c1",
  role: "client",
  is_primary: true,
  visible_to_client: true,
  sort_order: 0,
  contact: {
    id: "c1",
    kind: "client",
    full_name: "Sarah Bennett",
    company: null,
    trade: null,
    phone: null,
    whatsapp: null,
    email,
    notes: null,
    user_id,
  },
});

const member = (user_id: string): Member => ({
  project_id: "p1",
  user_id,
  role: "client",
  last_read_at: null,
  created_at: "2026-01-01T00:00:00Z",
  profile: { id: user_id, full_name: "Sarah Bennett", avatar_url: null },
});

describe("clientAccessStatus", () => {
  it("is none when the project has no client, or the client contact has no email", () => {
    expect(clientAccessStatus(undefined, [])).toBe("none");
    expect(clientAccessStatus(client(null, null), [])).toBe("none");
  });

  it("is waiting when there's an email but no linked, granted account yet", () => {
    expect(clientAccessStatus(client("sarah@example.com", null), [])).toBe("waiting");
    // Linked but the membership isn't there (e.g. hasn't synced yet): still waiting.
    expect(clientAccessStatus(client("sarah@example.com", "u1"), [])).toBe("waiting");
  });

  it("is access once the linked account holds a client membership on this project", () => {
    expect(clientAccessStatus(client("sarah@example.com", "u1"), [member("u1")])).toBe("access");
  });

  it("isn't fooled by another project's client membership", () => {
    expect(clientAccessStatus(client("sarah@example.com", "u1"), [member("u2")])).toBe("waiting");
  });
});

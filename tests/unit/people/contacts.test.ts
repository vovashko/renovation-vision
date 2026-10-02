import { describe, it, expect } from "vitest";
import { contactsInRole, crewOf, nextSortOrder, primaryIn, telHref, toContactFields } from "@/features/people/domain/contacts";
import type { ProjectContact, ProjectContactRole } from "@/lib/database.types";

const link = (name: string, role: ProjectContactRole, sort_order: number, is_primary = false): ProjectContact => ({
  id: `l-${name}`,
  project_id: "p1",
  contact_id: `c-${name}`,
  role,
  is_primary,
  visible_to_client: role === "poc",
  sort_order,
  contact: {
    id: `c-${name}`,
    kind: role === "crew" ? "crew" : role === "client" ? "client" : "other",
    full_name: name,
    company: null,
    trade: null,
    phone: null,
    whatsapp: null,
    email: null,
    notes: null,
    user_id: null,
  },
});

const links = [
  link("Kai", "crew", 4),
  link("Marek", "crew", 1),
  link("Ana", "crew", 2),
  link("Jonas", "poc", 0, true),
  link("Old client", "client", 0),
  link("Bennetts", "client", 1, true),
];

describe("project contacts", () => {
  it("crewOf lists only crew, in sort order", () => {
    expect(crewOf(links).map((l) => l.contact.full_name)).toEqual(["Marek", "Ana", "Kai"]);
  });

  it("primaryIn prefers the primary contact over sort order", () => {
    expect(primaryIn(links, "client")?.contact.full_name).toBe("Bennetts");
    expect(primaryIn(links, "poc")?.contact.full_name).toBe("Jonas");
    expect(primaryIn(links, "supplier")).toBeUndefined();
  });

  it("contactsInRole breaks sort-order ties by name", () => {
    const tied = [link("Zoe", "supplier", 1), link("Adam", "supplier", 1)];
    expect(contactsInRole(tied, "supplier").map((l) => l.contact.full_name)).toEqual(["Adam", "Zoe"]);
  });

  it("nextSortOrder places a new contact after the last one in its role", () => {
    expect(nextSortOrder(links, "crew")).toBe(5);
    expect(nextSortOrder(links, "supplier")).toBe(1);
  });

  it("toContactFields turns empty form fields into nulls and trims the rest", () => {
    expect(toContactFields({ full_name: " Alex ", trade: "", phone: " +48 600 ", email: "" })).toEqual({
      full_name: "Alex",
      trade: null,
      phone: "+48 600",
      email: null,
    });
  });

  it("telHref keeps only digits and +", () => {
    expect(telHref("+48 600-100 (200)")).toBe("tel:+48600100200");
  });
});

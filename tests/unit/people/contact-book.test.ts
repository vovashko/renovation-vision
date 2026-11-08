import { describe, expect, it } from "vitest";
import {
  ASSIGNABLE_ROLES,
  deleteBlockedBy,
  defaultRoleFor,
  filterContacts,
  freeRoles,
  hasFilters,
  isAssignableRole,
  matchesQuery,
  NO_FILTERS,
  tradesOf,
  visibleByDefault,
} from "@/features/people/domain/contact-book";
import { assignContactSchema, contactFormSchema, emptyContact } from "@/features/people/domain/schemas";
import type { Contact } from "@/lib/database.types";

const contact = (over: Partial<Contact> & { id: string; full_name: string }): Contact => ({
  kind: "other",
  company: null,
  trade: null,
  phone: null,
  whatsapp: null,
  email: null,
  notes: null,
  user_id: null,
  ...over,
});

const book: Contact[] = [
  contact({ id: "1", full_name: "Marek Nowak", kind: "crew", trade: "Site lead", phone: "+48 600 100 200" }),
  contact({ id: "2", full_name: "Ana Petrović", kind: "crew", trade: "Electrician", email: "ana@example.com" }),
  contact({ id: "3", full_name: "Płytki24", kind: "supplier", company: "Hurtownia Płytek", trade: "Tiles", whatsapp: "+48600100201" }),
  contact({ id: "4", full_name: "Sarah Bennett", kind: "client", email: "sarah@renovision.demo" }),
  contact({ id: "5", full_name: "Zofia Lis", kind: "architect", trade: "electrician" }),
];

const names = (list: Contact[]) => list.map((c) => c.full_name);

describe("filterContacts: search", () => {
  it("returns everyone, sorted by name, with no filters", () => {
    expect(names(filterContacts(book, NO_FILTERS))).toEqual(["Ana Petrović", "Marek Nowak", "Płytki24", "Sarah Bennett", "Zofia Lis"]);
  });

  it("searches name, company, trade, email and notes, ignoring case", () => {
    expect(names(filterContacts(book, { ...NO_FILTERS, query: "MAREK" }))).toEqual(["Marek Nowak"]);
    expect(names(filterContacts(book, { ...NO_FILTERS, query: "hurtownia" }))).toEqual(["Płytki24"]);
    expect(names(filterContacts(book, { ...NO_FILTERS, query: "electrician" }))).toEqual(["Ana Petrović", "Zofia Lis"]);
    expect(names(filterContacts(book, { ...NO_FILTERS, query: "renovision.demo" }))).toEqual(["Sarah Bennett"]);
  });

  it("matches without Polish letters or diacritics", () => {
    expect(names(filterContacts(book, { ...NO_FILTERS, query: "plytki" }))).toEqual(["Płytki24"]);
    expect(names(filterContacts(book, { ...NO_FILTERS, query: "petrovic" }))).toEqual(["Ana Petrović"]);
  });

  it("matches phone digits however the number is written", () => {
    expect(names(filterContacts(book, { ...NO_FILTERS, query: "600 100 200" }))).toEqual(["Marek Nowak"]);
    expect(names(filterContacts(book, { ...NO_FILTERS, query: "600100201" }))).toEqual(["Płytki24"]);
    expect(names(filterContacts(book, { ...NO_FILTERS, query: "+48600100200" }))).toEqual(["Marek Nowak"]);
  });

  it("needs every word to match", () => {
    expect(names(filterContacts(book, { ...NO_FILTERS, query: "marek electrician" }))).toEqual([]);
    expect(matchesQuery(book[0], "  ")).toBe(true);
  });
});

describe("filterContacts: kind and trade", () => {
  it("filters by kind", () => {
    expect(names(filterContacts(book, { ...NO_FILTERS, kind: "crew" }))).toEqual(["Ana Petrović", "Marek Nowak"]);
    expect(names(filterContacts(book, { ...NO_FILTERS, kind: "client" }))).toEqual(["Sarah Bennett"]);
  });

  it("filters by trade, ignoring case", () => {
    expect(names(filterContacts(book, { ...NO_FILTERS, trade: "Electrician" }))).toEqual(["Ana Petrović", "Zofia Lis"]);
  });

  it("combines search, kind and trade", () => {
    expect(names(filterContacts(book, { query: "ana", kind: "crew", trade: "Electrician" }))).toEqual(["Ana Petrović"]);
    expect(filterContacts(book, { query: "zofia", kind: "crew", trade: "" })).toEqual([]);
  });

  it("lists each trade once (one spelling), sorted", () => {
    expect(tradesOf(book)).toEqual(["Electrician", "Site lead", "Tiles"]);
  });

  it("knows whether any filter is active", () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, kind: "crew" })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, query: " x" })).toBe(true);
  });
});

describe("the delete guard", () => {
  it("allows deleting a contact with no projects", () => {
    expect(deleteBlockedBy({ total: 0, managed: [] })).toEqual({ blocked: false, total: 0, managed: [], hidden: 0 });
  });

  it("blocks a contact that is on a project and names the ones the caller manages", () => {
    const managed = [
      { project_id: "p1", name: "Maple Street", role: "crew" as const },
      { project_id: "p1", name: "Maple Street", role: "poc" as const },
    ];
    expect(deleteBlockedBy({ total: 2, managed })).toEqual({ blocked: true, total: 2, managed: ["Maple Street"], hidden: 0 });
  });

  it("blocks on links the caller can't see, and counts them", () => {
    const managed = [{ project_id: "p1", name: "Maple Street", role: "crew" as const }];
    expect(deleteBlockedBy({ total: 3, managed })).toMatchObject({ blocked: true, total: 3, hidden: 2 });
    expect(deleteBlockedBy({ total: 1, managed: [] })).toMatchObject({ blocked: true, managed: [], hidden: 1 });
  });
});

describe("project assignment roles", () => {
  it("never offers the client role", () => {
    expect([...ASSIGNABLE_ROLES]).toEqual(["poc", "crew", "supplier", "architect"]);
    expect(ASSIGNABLE_ROLES).not.toContain("client");
    expect(isAssignableRole("client")).toBe(false);
    expect(isAssignableRole("poc")).toBe(true);
  });

  it("the assign form schema rejects the client role", () => {
    const ok = assignContactSchema.safeParse({ project_id: "p1", role: "crew", visible_to_client: false });
    expect(ok.success).toBe(true);
    expect(assignContactSchema.safeParse({ project_id: "p1", role: "client", visible_to_client: true }).success).toBe(false);
  });

  it("offers the roles the contact does not already hold on that project", () => {
    const links = [
      { project_id: "p1", role: "crew" as const },
      { project_id: "p1", role: "client" as const },
      { project_id: "p2", role: "poc" as const },
    ];
    expect(freeRoles(links, "p1")).toEqual(["poc", "supplier", "architect"]);
    expect(freeRoles(links, "p2")).toEqual(["crew", "supplier", "architect"]);
    expect(freeRoles(links, "p3")).toEqual(["poc", "crew", "supplier", "architect"]);
  });

  it("pre-selects a role from the kind, and shows only a point of contact to the client by default", () => {
    expect(defaultRoleFor("supplier")).toBe("supplier");
    expect(defaultRoleFor("crew")).toBe("crew");
    expect(defaultRoleFor("client")).toBe("poc");
    expect(visibleByDefault("poc")).toBe(true);
    expect(visibleByDefault("crew")).toBe(false);
  });
});

describe("contactFormSchema", () => {
  const valid = { ...emptyContact, full_name: "Marek" };

  it("requires a name", () => {
    const r = contactFormSchema.safeParse({ ...valid, full_name: " " });
    expect(r.success ? undefined : r.error.issues[0].message).toBe("common:form.required");
  });

  it("normalizes the WhatsApp number to E.164 and accepts blank", () => {
    const r = contactFormSchema.safeParse({ ...valid, whatsapp: "+48 600-100-200" });
    expect(r.success && r.data.whatsapp).toBe("+48600100200");
    expect(contactFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a WhatsApp number that isn't international", () => {
    const r = contactFormSchema.safeParse({ ...valid, whatsapp: "600 100 200" });
    expect(r.success).toBe(false);
    expect(r.success ? undefined : r.error.issues[0].message).toBe("people:contacts.errors.whatsapp");
  });

  it("rejects a bad email and an unknown kind", () => {
    expect(contactFormSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(contactFormSchema.safeParse({ ...valid, kind: "investor" }).success).toBe(false);
  });
});

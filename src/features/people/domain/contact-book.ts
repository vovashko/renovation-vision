// Pure rules for the address book page (`/contacts`): search and filters, the roles a contact can be given on a
// project, and when a contact may be deleted. No Supabase, no React.
import type { Contact, ContactKind, ProjectContactRole } from "@/lib/database.types";

export const CONTACT_KINDS: ContactKind[] = ["client", "crew", "supplier", "architect", "other"];

/**
 * The roles a contact can be assigned on a project from the address book. `client` is never one of them: a
 * project's client is set on the client card (`set_project_client`), which also grants the account access.
 */
export const ASSIGNABLE_ROLES = ["poc", "crew", "supplier", "architect"] as const satisfies readonly ProjectContactRole[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const isAssignableRole = (role: string): role is AssignableRole => (ASSIGNABLE_ROLES as readonly string[]).includes(role);

/** The role a contact of this kind is most likely to get, to pre-select in the assign form. */
export function defaultRoleFor(kind: ContactKind): AssignableRole {
  if (kind === "supplier" || kind === "architect" || kind === "crew") return kind;
  return "poc";
}

/** Only a point of contact is meant for the client to see by default; crew and suppliers are internal until opted in. */
export const visibleByDefault = (role: AssignableRole): boolean => role === "poc";

export type ContactFilters = {
  query: string;
  /** "" = every kind */
  kind: ContactKind | "";
  /** "" = every trade; compared case-insensitively */
  trade: string;
};

export const NO_FILTERS: ContactFilters = { query: "", kind: "", trade: "" };

/** Lowercase, no diacritics (including ł): "Płytki" → "plytki", so a search typed without Polish letters still matches. */
export function fold(text: string): string {
  return text.toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const digits = (text: string) => text.replace(/\D/g, "");

/** Does the contact match the search text? Every word must appear in the name, company, trade, email, notes or phone digits. */
export function matchesQuery(contact: Contact, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fold([contact.full_name, contact.company, contact.trade, contact.email, contact.notes].filter(Boolean).join(" "));
  const numbers = digits(`${contact.phone ?? ""} ${contact.whatsapp ?? ""}`);
  // A word that is a number ("600", "+48600100200") is also looked for in the phone digits, however they were typed.
  return words.every((w) => haystack.includes(w) || (/^\+?\d{3,}$/.test(w) && numbers.includes(digits(w))));
}

/** The contacts that pass the search, kind and trade filters, sorted by name. */
export function filterContacts(contacts: Contact[], filters: ContactFilters): Contact[] {
  const trade = fold(filters.trade.trim());
  return contacts
    .filter((c) => (filters.kind === "" || c.kind === filters.kind) && (trade === "" || fold(c.trade ?? "") === trade))
    .filter((c) => matchesQuery(c, filters.query))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/** The distinct trades in the book (the filter's options), one spelling each, sorted. */
export function tradesOf(contacts: Contact[]): string[] {
  const byFolded = new Map<string, string>();
  for (const c of contacts) {
    const trade = c.trade?.trim();
    if (trade && !byFolded.has(fold(trade))) byFolded.set(fold(trade), trade);
  }
  return [...byFolded.values()].sort((a, b) => a.localeCompare(b));
}

export const hasFilters = (f: ContactFilters) => f.query.trim() !== "" || f.kind !== "" || f.trade !== "";

/**
 * Deleting a contact removes it from every project it is on (and, for a client, that project's access), so the
 * page refuses while it is linked and tells the manager which projects to remove it from first.
 */
export function deleteBlockedBy<T extends { project_id: string }>(links: T[]): { blocked: boolean; links: T[] } {
  return { blocked: links.length > 0, links };
}

/** Roles still free for a contact on a project: the ones it doesn't already hold there. */
export function freeRoles(links: { project_id: string; role: ProjectContactRole }[], projectId: string): AssignableRole[] {
  const held = new Set(links.filter((l) => l.project_id === projectId).map((l) => l.role));
  return ASSIGNABLE_ROLES.filter((r) => !held.has(r));
}

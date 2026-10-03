// Pure rules for a project's contacts (`project_contacts` joined to `contacts`). No Supabase, no React.
import type { ProjectContact, ProjectContactRole } from "@/lib/database.types";

const byOrder = (a: ProjectContact, b: ProjectContact) =>
  Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order || a.contact.full_name.localeCompare(b.contact.full_name);

/** A project's contacts in one role: primary first, then by sort order, then by name. */
export function contactsInRole(links: ProjectContact[], role: ProjectContactRole): ProjectContact[] {
  return links.filter((l) => l.role === role).sort(byOrder);
}

/** The project's crew, in their sort order. */
export const crewOf = (links: ProjectContact[]) => contactsInRole(links, "crew");

/** The contact a card shows for a role: the primary one, or the first one when none is marked primary. */
export const primaryIn = (links: ProjectContact[], role: ProjectContactRole): ProjectContact | undefined => contactsInRole(links, role)[0];

/** The sort order for a new contact in a role: after the last one. */
export function nextSortOrder(links: ProjectContact[], role: ProjectContactRole): number {
  return links.filter((l) => l.role === role).reduce((max, l) => Math.max(max, l.sort_order), 0) + 1;
}

/** Form values ("" for an empty optional field) → `contacts` columns (null for empty). */
export function toContactFields<T extends Record<string, string>>(values: T): { [K in keyof T]: string | null } {
  const out = {} as { [K in keyof T]: string | null };
  for (const key of Object.keys(values) as (keyof T)[]) out[key] = values[key].trim() || null;
  return out;
}

/** `tel:` link for a phone number as people type it ("+48 600 100 200" → "tel:+48600100200"). */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

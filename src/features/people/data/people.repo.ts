// The only file in `features/people` that talks to Supabase: project members, and the project's
// contacts (`project_contacts` links to the company-wide `contacts` book).
import { supabase } from "@/lib/supabase";
import type { Contact, ContactKind, Member, ProjectContact, ProjectContactRole, ProjectRole, VisibleContact } from "@/lib/database.types";

/** The editable fields of an address-book entry (null clears one). */
export type ContactFields = Partial<Pick<Contact, "full_name" | "trade" | "phone" | "email" | "company">>;

/** A new contact and how it joins the project. */
export type NewProjectContact = {
  kind: ContactKind;
  role: ProjectContactRole;
  fields: ContactFields & { full_name: string };
  sortOrder?: number;
  isPrimary?: boolean;
  visibleToClient?: boolean;
};

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

const CONTACT_COLUMNS = "id, kind, full_name, company, trade, phone, whatsapp, email, notes, user_id";
const LINK_COLUMNS = `id, project_id, contact_id, role, is_primary, visible_to_client, sort_order, contact:contacts(${CONTACT_COLUMNS})`;

export const peopleRepo = {
  async listMembers(projectId: string): Promise<Member[]> {
    return must(
      sb().from("project_members").select("*, profile:profiles(id, full_name, avatar_url)").eq("project_id", projectId).order("created_at"),
    ) as Promise<Member[]>;
  },

  async addMember(projectId: string, email: string, role: ProjectRole): Promise<void> {
    await must(sb().rpc("add_project_member", { p_project: projectId, p_email: email, p_role: role }));
  },

  async removeMember(projectId: string, userId: string): Promise<void> {
    await must(sb().from("project_members").delete().eq("project_id", projectId).eq("user_id", userId));
  },

  /** Every contact linked to the project (managers only; RLS returns nothing to clients). */
  async listProjectContacts(projectId: string): Promise<ProjectContact[]> {
    const rows = (await must(
      sb().from("project_contacts").select(LINK_COLUMNS).eq("project_id", projectId).order("sort_order").order("created_at"),
    )) as unknown as (Omit<ProjectContact, "contact"> & { contact: Contact | null })[];
    // A link whose contact RLS hides (a non-staff manager) has nothing to show.
    return rows.filter((r): r is ProjectContact => r.contact !== null);
  },

  /** Creates the address-book entry, then links it to the project. A failed link leaves the contact in the book. */
  async addProjectContact(projectId: string, input: NewProjectContact): Promise<void> {
    const created = (await must(
      sb()
        .from("contacts")
        .insert({ kind: input.kind, ...input.fields })
        .select("id")
        .single(),
    )) as { id: string };
    await must(
      sb()
        .from("project_contacts")
        .insert({
          project_id: projectId,
          contact_id: created.id,
          role: input.role,
          sort_order: input.sortOrder ?? 0,
          is_primary: input.isPrimary ?? false,
          visible_to_client: input.visibleToClient ?? false,
        }),
    );
  },

  /** Edits the address-book entry (every project it's linked to sees the change). */
  async updateContact(contactId: string, fields: ContactFields): Promise<void> {
    await must(sb().from("contacts").update(fields).eq("id", contactId));
  },

  /** Removes the contact from the project; the address-book entry stays. */
  async unlinkProjectContact(linkId: string): Promise<void> {
    await must(sb().from("project_contacts").delete().eq("id", linkId));
  },

  /** The project's client-visible contacts (name, phone, email), for any member. */
  async listVisibleContacts(projectId: string): Promise<VisibleContact[]> {
    return must(sb().rpc("project_visible_contacts", { p_project: projectId })) as Promise<VisibleContact[]>;
  },
};

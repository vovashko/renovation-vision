// The only file in `features/people` that talks to Supabase: project members, and the project's
// contacts (`project_contacts` links to the company-wide `contacts` book).
import { supabase } from "@/lib/supabase";
import type { ContactLinkSummary } from "../domain/contact-book";
import type { Contact, ContactKind, Member, ProjectContact, ProjectContactRole, ProjectRole, VisibleContact } from "@/lib/database.types";

/** The editable fields of an address-book entry (null clears one). */
export type ContactFields = Partial<Pick<Contact, "full_name" | "kind" | "trade" | "phone" | "whatsapp" | "email" | "company" | "notes">>;

/** A project a contact is linked to, with its role there (what the address book shows and what blocks a delete). */
export type ContactLink = {
  id: string;
  project_id: string;
  role: ProjectContactRole;
  is_primary: boolean;
  visible_to_client: boolean;
  project: { id: string; name: string } | null;
};

/** A new contact and how it joins the project. */
export type NewProjectContact = {
  kind: ContactKind;
  role: ProjectContactRole;
  fields: ContactFields & { full_name: string };
  sortOrder?: number;
  isPrimary?: boolean;
  visibleToClient?: boolean;
};

type Result<T> = { data: T | null; error: { message: string; hint?: string | null; code?: string } | null };

/** An error from the database; `hint` is the machine-readable code an RPC raised (e.g. `client_email_in_use`). */
export class PeopleRepoError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
    /** The Postgres SQLSTATE, e.g. "23505" for a duplicate. */
    readonly code?: string,
  ) {
    super(message);
  }
}

async function must<T>(p: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new PeopleRepoError(error.message, error.hint ?? undefined, error.code);
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

  /**
   * Sets who the project's client is (`set_project_client`): reuses a contact by email, links it, and grants
   * access to the account with that email. Blank phone clears it. Returns the contact id.
   */
  async setProjectClient(projectId: string, input: { full_name: string; email: string; phone: string }): Promise<string> {
    return must(
      sb().rpc("set_project_client", {
        p_project: projectId,
        p_full_name: input.full_name,
        p_email: input.email,
        p_phone: input.phone,
      }),
    ) as Promise<string>;
  },

  /** The project's client-visible contacts (name, phone, email), for any member. */
  async listVisibleContacts(projectId: string): Promise<VisibleContact[]> {
    return must(sb().rpc("project_visible_contacts", { p_project: projectId })) as Promise<VisibleContact[]>;
  },

  // --- The address book (`/contacts`, staff only) --------------------------------------------------------------

  /** Every contact in the company address book. */
  async listContacts(): Promise<Contact[]> {
    return must(sb().from("contacts").select(CONTACT_COLUMNS).order("full_name")) as Promise<Contact[]>;
  },

  /** The projects a contact is on, with the role there. Only projects the signed-in manager manages are visible. */
  async listContactLinks(contactId: string): Promise<ContactLink[]> {
    return must(
      sb()
        .from("project_contacts")
        .select("id, project_id, role, is_primary, visible_to_client, project:projects(id, name)")
        .eq("contact_id", contactId)
        .order("created_at"),
    ) as unknown as Promise<ContactLink[]>;
  },

  /** How many projects a contact is on (all of them) and which of those the caller manages. Staff only. */
  async contactLinkSummary(contactId: string): Promise<ContactLinkSummary> {
    return must(sb().rpc("contact_project_links", { p_contact: contactId })) as Promise<ContactLinkSummary>;
  },

  /** Adds a contact to the book (not to any project). */
  async createContact(fields: ContactFields & { full_name: string }): Promise<string> {
    const created = (await must(sb().from("contacts").insert(fields).select("id").single())) as { id: string };
    return created.id;
  },

  async deleteContact(contactId: string): Promise<void> {
    await must(sb().from("contacts").delete().eq("id", contactId));
  },

  /** Puts a contact on a project in a role. The `client` role is refused here: the client card is its only path. */
  async assignContact(
    contactId: string,
    input: { projectId: string; role: Exclude<ProjectContactRole, "client">; visibleToClient: boolean },
  ): Promise<void> {
    if ((input.role as string) === "client") throw new PeopleRepoError("Clients are added on the client card", "client_role_not_allowed");
    await must(
      sb().from("project_contacts").insert({
        project_id: input.projectId,
        contact_id: contactId,
        role: input.role,
        visible_to_client: input.visibleToClient,
      }),
    );
  },

  /** Shows or hides a project contact for the client (the point of contact card). */
  async setLinkVisible(linkId: string, visible: boolean): Promise<void> {
    await must(sb().from("project_contacts").update({ visible_to_client: visible }).eq("id", linkId));
  },
};

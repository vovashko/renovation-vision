// App-facing row types for the shared RenoVision Supabase schema, derived from the generated
// `src/domain/db.types.ts` (regenerate with `bun run db:types` after a migration change).
// Each exported type below picks exactly the columns the portal reads/writes, plus a few
// app-side extras computed by the API layer (Photo/Render `url`, Stage `tasks`, Message
// `attachment_url`, Member `profile`) that don't exist as columns.
import type { Database } from "@/domain/db.types";

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];

export type ProjectRole = Enums<"project_role">;
export type ScheduleStatus = Enums<"schedule_status">;
export type PhotoStatus = Enums<"photo_status">;

export type Profile = Pick<Tables<"profiles">, "id" | "full_name" | "avatar_url" | "account_type">;

export type ProjectStatus = Enums<"project_status">;
export type ContactKind = Enums<"contact_kind">;
export type ProjectContactRole = Enums<"project_contact_role">;

// `address` is generated ("<line>, <postal code> <city>"), so the generated types call it nullable; the expression
// never returns null.
export type Project = Pick<
  Tables<"projects">,
  | "id"
  | "name"
  | "address_line"
  | "postal_code"
  | "city"
  | "country"
  | "currency"
  | "status"
  | "start_date"
  | "target_date"
  | "budget"
  | "spent"
  | "schedule_status"
  | "schedule_note"
  | "created_at"
  | "updated_at"
> & { address: string };

// Postgres marks every view column nullable, so the generated view row can't be used as is: the base columns
// come from `projects` (non-null there) and the aggregates are coalesced in the view's SQL.
type SummaryView = Views<"project_summary">;
export type ProjectSummary = Project & {
  overall_progress: NonNullable<SummaryView["overall_progress"]>;
  stages_done: NonNullable<SummaryView["stages_done"]>;
  stages_total: NonNullable<SummaryView["stages_total"]>;
  current_stage: SummaryView["current_stage"];
  manager_name: SummaryView["manager_name"];
  /** The primary client contact's name. Null for clients (they can't read contacts) and when there is none. */
  client_display_name: SummaryView["client_display_name"];
};

export type ProjectInternal = Pick<Tables<"project_internal">, "project_id" | "internal_budget_notes" | "updated_at">;

/** An address-book entry (company-wide). Staff only. */
export type Contact = Pick<
  Tables<"contacts">,
  "id" | "kind" | "full_name" | "company" | "trade" | "phone" | "whatsapp" | "email" | "notes" | "user_id"
>;

/** A contact's role on one project, with the contact. Managers of the project only. */
export type ProjectContact = Pick<
  Tables<"project_contacts">,
  "id" | "project_id" | "contact_id" | "role" | "is_primary" | "visible_to_client" | "sort_order"
> & { contact: Contact };

/** What `project_visible_contacts(project)` returns: a client-visible contact's role, name, phone and email. */
export type VisibleContact = {
  role: ProjectContactRole;
  full_name: string;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
};

export type Member = Pick<Tables<"project_members">, "project_id" | "user_id" | "role" | "last_read_at" | "created_at"> & {
  profile: Pick<Profile, "id" | "full_name" | "avatar_url">;
};

export type Room = Pick<
  Tables<"rooms">,
  "id" | "project_id" | "key" | "name" | "status" | "progress" | "x" | "y" | "w" | "h" | "client_note" | "sort_order" | "is_visible"
>;

export type Task = Pick<Tables<"tasks">, "id" | "project_id" | "stage_id" | "room_id" | "name" | "done" | "sort_order" | "is_visible">;

export type Stage = Pick<
  Tables<"stages">,
  "id" | "project_id" | "key" | "name" | "status" | "progress" | "start_date" | "end_date" | "client_note" | "sort_order" | "is_visible"
> & { tasks: Task[] };

export type Photo = Pick<
  Tables<"photos">,
  "id" | "project_id" | "stage_id" | "room_id" | "storage_path" | "alt" | "caption" | "taken_at" | "uploaded_by" | "status" | "published_at"
> & {
  /** Signed URL, resolved by the API layer. */
  url: string;
};

export type Render = Pick<
  Tables<"renders">,
  "id" | "project_id" | "room_id" | "storage_path" | "alt" | "title" | "description" | "compare_photo_id" | "sort_order" | "is_visible"
> & { url: string };

export type Expense = Pick<
  Tables<"expenses">,
  "id" | "project_id" | "stage_id" | "category" | "description" | "vendor" | "vendor_notes" | "amount" | "spent_on" | "receipt_path"
>;

export type Message = Pick<Tables<"messages">, "id" | "project_id" | "sender_id" | "body" | "attachment_path" | "created_at"> & {
  attachment_url?: string | null;
};

export type Notification = Pick<
  Tables<"notifications">,
  "id" | "project_id" | "recipient_id" | "kind" | "title" | "body" | "link" | "created_at" | "read_at"
>;

export type ActivityEntry = Omit<
  Pick<
    Tables<"activity_log">,
    "id" | "project_id" | "actor_id" | "action" | "entity_type" | "entity_id" | "summary" | "changes" | "created_at"
  >,
  "changes"
> & {
  changes: Record<string, { from: unknown; to: unknown }>;
};

export type Knowledge = Pick<Tables<"ai_knowledge">, "id" | "project_id" | "title" | "content" | "tags" | "is_visible" | "updated_at">;

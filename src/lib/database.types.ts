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
/** `tasks`: a stage's progress and status follow its checklist (database triggers); `manual`: set by hand. */
export type ProgressMode = Enums<"progress_mode">;
export type NotificationChannel = Enums<"notification_channel">;
export type NotificationFrequency = Enums<"notification_frequency">;
export type CostCategory = Enums<"cost_category">;
export type MaterialStatus = Enums<"material_status">;
export type DocumentCategory = Enums<"document_category">;

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
  | "planned_target_date"
  | "planned_budget"
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
  /** The floor plan's background image in `project-media` (`<project_id>/plans/<file>`), or null. */
  plan_image_path: SummaryView["plan_image_path"];
  plan_image_opts: PlanImageOpts;
};

/** How the plan background is drawn under the rooms (`projects.plan_image_opts`); every key is optional. */
export type PlanImageOpts = { opacity?: number; scale?: number; x?: number; y?: number };

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
  | "id"
  | "project_id"
  | "key"
  | "name"
  | "status"
  | "progress"
  | "progress_mode"
  | "x"
  | "y"
  | "w"
  | "h"
  | "client_note"
  | "sort_order"
  | "is_visible"
>;

/** A checklist item. `stage_id` and/or `room_id` is set; `in_progress` marks a started, unfinished task (progress counts `done` only). */
export type Task = Pick<
  Tables<"tasks">,
  "id" | "project_id" | "stage_id" | "room_id" | "name" | "done" | "in_progress" | "sort_order" | "is_visible"
>;

export type Stage = Pick<
  Tables<"stages">,
  | "id"
  | "project_id"
  | "key"
  | "name"
  | "status"
  | "progress"
  | "progress_mode"
  | "start_date"
  | "end_date"
  | "client_note"
  | "sort_order"
  | "is_visible"
> & { tasks: Task[] };

/** A site diary entry. Clients read only `is_visible` entries of their own project (RLS). */
export type ProgressEntry = Pick<
  Tables<"progress_entries">,
  "id" | "project_id" | "stage_id" | "room_id" | "entry_date" | "author_id" | "note" | "hours" | "is_visible" | "created_at" | "updated_at"
>;

export type Photo = Pick<
  Tables<"photos">,
  | "id"
  | "project_id"
  | "stage_id"
  | "room_id"
  | "progress_entry_id"
  | "storage_path"
  | "alt"
  | "caption"
  | "taken_at"
  | "uploaded_by"
  | "status"
  | "published_at"
> & {
  /** Signed URL, resolved by the API layer. */
  url: string;
};

/** A project document row (`documents`). The file itself is fetched through a signed URL on demand. */
export type ProjectDocument = Pick<
  Tables<"documents">,
  | "id"
  | "project_id"
  | "category"
  | "title"
  | "description"
  | "storage_path"
  | "file_name"
  | "mime_type"
  | "size_bytes"
  | "version_group"
  | "version"
  | "is_current"
  | "room_id"
  | "task_id"
  | "uploaded_by"
  | "archived_at"
  | "created_at"
> & {
  /** Signed URL, only resolved for installation photos (the gallery thumbnails). */
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

/** A stage's planned cost (one row per stage). Managers of the project only; clients never see it. */
export type StageBudget = Pick<Tables<"stage_budgets">, "stage_id" | "project_id" | "planned_cost">;

/** Something the project buys. Managers of the project only (internal, like expenses). */
export type Material = Pick<
  Tables<"materials">,
  | "id"
  | "project_id"
  | "stage_id"
  | "room_id"
  | "name"
  | "supplier_contact_id"
  | "quantity"
  | "unit"
  | "unit_price"
  | "status"
  | "expense_id"
  | "progress_entry_id"
  | "notes"
  | "created_at"
>;

/**
 * What `room_materials(room)` returns: a room's material without prices, supplier or notes. The only material
 * read open to clients. Postgres marks every function column nullable, hence the NonNullable mapping.
 */
type RoomMaterialRow = Database["public"]["Functions"]["room_materials"]["Returns"][number];
export type RoomMaterial = {
  [K in keyof RoomMaterialRow]: K extends "order_by_date" | "delivery_date" ? string | null : NonNullable<RoomMaterialRow[K]>;
};

/** An investor warning on a room, with the ids of the materials it is linked to. Never changes a date. */
export type RoomWarning = Pick<Tables<"room_warnings">, "id" | "project_id" | "room_id" | "text" | "created_by" | "created_at"> & {
  material_ids: string[];
};

// Postgres marks every view column nullable; stage_costs starts from stage_budgets and coalesces its sums.
type StageCostsView = Views<"stage_costs">;
/** Planned, spent, committed (ordered/delivered materials not yet linked to an expense) and remaining, per stage. */
export type StageCost = { [K in keyof StageCostsView]: NonNullable<StageCostsView[K]> };

/** `sender_id` is null once the sender's account was deleted (shown as "Former member"). */
export type Message = Pick<Tables<"messages">, "id" | "project_id" | "sender_id" | "body" | "attachment_path" | "created_at"> & {
  attachment_url?: string | null;
};

/** A jsonb object column (notification/activity `params`): read its values defensively. */
export type JsonParams = Record<string, unknown>;

/**
 * Rendered from `kind` + `params` through i18n (features/comms/domain/notification-text.ts);
 * `title`/`body` are the legacy English text, the fallback for kinds the app doesn't know.
 */
export type Notification = Omit<
  Pick<
    Tables<"notifications">,
    "id" | "project_id" | "recipient_id" | "kind" | "params" | "title" | "body" | "link" | "created_at" | "read_at"
  >,
  "params"
> & { params: JsonParams };

/** Rendered from `params` ({ entity, action, label }) through i18n; `summary` (English) is the fallback. */
export type ActivityEntry = Omit<
  Pick<
    Tables<"activity_log">,
    "id" | "project_id" | "actor_id" | "action" | "entity_type" | "entity_id" | "summary" | "changes" | "params" | "created_at"
  >,
  "changes" | "params"
> & {
  changes: Record<string, { from: unknown; to: unknown }>;
  params: JsonParams;
};

/** Pending, accepted or revoked invitations (managers read their project's; `token_hash` is never readable). */
export type Invitation = Pick<
  Tables<"invitations">,
  "id" | "email" | "role" | "project_id" | "invited_by" | "expires_at" | "accepted_at" | "revoked_at" | "created_at"
>;

export type NotificationPreference = Pick<Tables<"notification_preferences">, "user_id" | "kind" | "channel" | "frequency">;

export type Consent = Pick<Tables<"consents">, "id" | "user_id" | "kind" | "version" | "granted_at">;

export type Knowledge = Pick<Tables<"ai_knowledge">, "id" | "project_id" | "title" | "content" | "tags" | "is_visible" | "updated_at">;

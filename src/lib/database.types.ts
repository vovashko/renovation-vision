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
export type NotificationChannel = Enums<"notification_channel">;
export type NotificationFrequency = Enums<"notification_frequency">;

export type Profile = Pick<Tables<"profiles">, "id" | "full_name" | "avatar_url" | "account_type">;

export type Project = Pick<
  Tables<"projects">,
  | "id"
  | "name"
  | "address"
  | "client_name"
  | "start_date"
  | "target_date"
  | "budget"
  | "spent"
  | "schedule_status"
  | "schedule_note"
  | "created_at"
  | "updated_at"
>;

// Postgres marks every view column nullable, so the generated view row can't be used as is: the base columns
// come from `projects` (non-null there) and the aggregates are coalesced in the view's SQL.
type SummaryView = Views<"project_summary">;
export type ProjectSummary = Project & {
  overall_progress: NonNullable<SummaryView["overall_progress"]>;
  stages_done: NonNullable<SummaryView["stages_done"]>;
  stages_total: NonNullable<SummaryView["stages_total"]>;
  current_stage: SummaryView["current_stage"];
  manager_name: SummaryView["manager_name"];
};

export type ProjectInternal = Pick<
  Tables<"project_internal">,
  "project_id" | "internal_budget_notes" | "client_phone" | "client_email" | "updated_at"
>;

/** Site crew and trades (not app users). Manager-only. */
export type CrewMember = Pick<Tables<"project_crew">, "id" | "project_id" | "name" | "trade" | "phone" | "email" | "sort_order">;

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

// Row types for the shared RenoVision Supabase schema (supabase/migrations at the repo root).
// Keep in sync with the migrations, or regenerate with `supabase gen types typescript`.
import type { Status } from "@/lib/status";

export type ProjectRole = "manager" | "client";
export type ScheduleStatus = "on_schedule" | "at_risk" | "delayed";
export type PhotoStatus = "draft" | "published";

export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  account_type: "manager" | "client";
};

export type Project = {
  id: string;
  name: string;
  address: string;
  client_name: string;
  start_date: string | null;
  target_date: string | null;
  budget: number;
  spent: number;
  schedule_status: ScheduleStatus;
  schedule_note: string;
  created_at: string;
  updated_at: string;
};

export type ProjectSummary = Project & {
  overall_progress: number;
  stages_done: number;
  stages_total: number;
  current_stage: string | null;
  manager_name: string | null;
};

export type ProjectInternal = { project_id: string; internal_budget_notes: string; updated_at: string };

export type Member = {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  last_read_at: string | null;
  created_at: string;
  profile: Pick<Profile, "id" | "full_name" | "avatar_url">;
};

export type Room = {
  id: string;
  project_id: string;
  key: string;
  name: string;
  status: Status;
  progress: number;
  x: number;
  y: number;
  w: number;
  h: number;
  client_note: string;
  sort_order: number;
  is_visible: boolean;
};

export type Task = {
  id: string;
  project_id: string;
  stage_id: string;
  room_id: string | null;
  name: string;
  done: boolean;
  sort_order: number;
  is_visible: boolean;
};

export type Stage = {
  id: string;
  project_id: string;
  key: string;
  name: string;
  status: Status;
  progress: number;
  start_date: string;
  end_date: string;
  client_note: string;
  sort_order: number;
  is_visible: boolean;
  tasks: Task[];
};

export type Photo = {
  id: string;
  project_id: string;
  stage_id: string | null;
  room_id: string | null;
  storage_path: string;
  alt: string;
  caption: string;
  taken_at: string;
  uploaded_by: string | null;
  status: PhotoStatus;
  published_at: string | null;
  /** Signed URL, resolved by the API layer. */
  url: string;
};

export type Render = {
  id: string;
  project_id: string;
  room_id: string | null;
  storage_path: string;
  alt: string;
  title: string;
  description: string;
  compare_photo_id: string | null;
  sort_order: number;
  is_visible: boolean;
  url: string;
};

export type Expense = {
  id: string;
  project_id: string;
  stage_id: string | null;
  category: string;
  description: string;
  vendor: string;
  vendor_notes: string;
  amount: number;
  spent_on: string;
  receipt_path: string | null;
};

export type Message = {
  id: string;
  project_id: string;
  sender_id: string;
  body: string;
  attachment_path: string | null;
  created_at: string;
  attachment_url?: string | null;
};

export type Notification = {
  id: string;
  project_id: string;
  recipient_id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  created_at: string;
  read_at: string | null;
};

export type ActivityEntry = {
  id: number;
  project_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  created_at: string;
};

export type Knowledge = {
  id: string;
  project_id: string;
  title: string;
  content: string;
  tags: string[];
  is_visible: boolean;
  updated_at: string;
};

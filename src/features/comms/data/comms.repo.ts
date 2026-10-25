// The only place in `features/comms` that talks to Supabase: notifications, announcements and the activity log.
import { supabase } from "@/lib/supabase";
import type { ActivityEntry, Notification } from "@/lib/database.types";

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

export const commsRepo = {
  async listNotifications(projectId: string): Promise<Notification[]> {
    return must(
      sb().from("notifications").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(300),
    ) as Promise<Notification[]>;
  },

  async notifyClients(projectId: string, title: string, body: string, link: string | null): Promise<void> {
    await must(sb().rpc("notify_project_clients", { p_project: projectId, p_title: title, p_body: body, p_link: link }));
  },

  async listActivity(projectId: string): Promise<ActivityEntry[]> {
    return must(
      sb().from("activity_log").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(200),
    ) as Promise<ActivityEntry[]>;
  },
};

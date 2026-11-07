// The only place in `features/comms` that talks to Supabase: notifications (the bell's inbox, read state and its
// realtime feed), email preferences, announcements and the activity log.
import { supabase } from "@/lib/supabase";
import type { ActivityEntry, InboxNotification, Notification } from "@/lib/database.types";
import { isEmailFrequency, PREFERENCE_GROUPS, type EmailFrequency, type PreferenceGroupKey } from "../domain/delivery";

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

/** One preference group's email frequency: the saved one, or the default `notification_pref` applies. */
export type EmailPreference = { frequency: EmailFrequency; saved: boolean };
export type EmailPreferences = Record<PreferenceGroupKey, EmailPreference>;

const INBOX_COLUMNS =
  "id, project_id, recipient_id, kind, params, title, body, link, entity_type, entity_id, created_at, read_at, project:projects(name)";

/** How many notifications the bell's inbox lists. */
export const INBOX_LIMIT = 50;

export const commsRepo = {
  async listNotifications(projectId: string): Promise<Notification[]> {
    return must(
      sb().from("notifications").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(300),
    ) as Promise<Notification[]>;
  },

  /** The signed-in user's own notifications, newest first, across their projects (`project` is many-to-one). */
  async listInbox(userId: string): Promise<InboxNotification[]> {
    const rows = await must(
      sb()
        .from("notifications")
        .select(INBOX_COLUMNS)
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(INBOX_LIMIT),
    );
    return rows as unknown as InboxNotification[];
  },

  async unreadCount(userId: string): Promise<number> {
    const { count, error } = await sb()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  /** Marks the user's own notifications read: `ids`, or all of them (null). */
  async markRead(ids: string[] | null): Promise<void> {
    await must(sb().rpc("mark_notifications_read", ids ? { p_ids: ids } : {}));
  },

  /** Calls `onChange` whenever one of the user's notifications is added, read or removed. Returns the unsubscribe. */
  subscribeToInbox(userId: string, onChange: () => void): () => void {
    const client = sb();
    const channel = client
      .channel(`inbox:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` }, onChange)
      .subscribe();
    return () => void client.removeChannel(channel);
  },

  /** Every preference group's email frequency as `notification_pref` sees it (saved, else the default). */
  async emailPreferences(userId: string): Promise<EmailPreferences> {
    const saved = await must(sb().from("notification_preferences").select("kind").eq("user_id", userId).eq("channel", "email"));
    const savedKinds = new Set((saved ?? []).map((r) => r.kind));
    const entries = await Promise.all(
      PREFERENCE_GROUPS.map(async (group) => {
        const value = await must(sb().rpc("notification_pref", { p_user: userId, p_kind: group.kinds[0], p_channel: "email" }));
        const preference: EmailPreference = {
          frequency: isEmailFrequency(value) ? value : "off",
          saved: group.kinds.some((k) => savedKinds.has(k)),
        };
        return [group.key, preference] as const;
      }),
    );
    return Object.fromEntries(entries) as EmailPreferences;
  },

  /** Saves one group's email frequency: one row per kind in the group. */
  async saveEmailPreference(userId: string, group: PreferenceGroupKey, frequency: EmailFrequency): Promise<void> {
    const kinds = PREFERENCE_GROUPS.find((g) => g.key === group)?.kinds ?? [];
    const rows = kinds.map((kind) => ({ user_id: userId, kind, channel: "email" as const, frequency }));
    await must(sb().from("notification_preferences").upsert(rows, { onConflict: "user_id,kind,channel" }));
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

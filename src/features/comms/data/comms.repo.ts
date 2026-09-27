// The only place in `features/comms` that talks to Supabase. Ported from `src/lib/api.ts`
// (read, not edited — six features share it until T17 removes it), keeping the same storage
// paths and realtime channel names other clients rely on.
import { supabase, MEDIA_BUCKET } from "@/lib/supabase";
import { fileExt } from "@/domain/text";
import type { ActivityEntry, Message, Notification, ProjectRole } from "@/lib/database.types";

export type PresenceMember = { id: string; name: string; role: ProjectRole };
/** `id` is the presence key (a user id); everything else is the payload other clients see. */
export type PresencePayload = { name: string; role: ProjectRole; at: string };

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

async function currentUserId() {
  const { data } = await sb().auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

async function signUrls(bucket: string, paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const data = await must(
    sb()
      .storage.from(bucket)
      .createSignedUrls(unique, 60 * 60),
  );
  return new Map(data.filter((d) => d.signedUrl).map((d) => [d.path as string, d.signedUrl]));
}

async function upload(bucket: string, path: string, file: File) {
  await must(
    sb()
      .storage.from(bucket)
      .upload(path, file, { contentType: file.type || undefined, upsert: false }),
  );
  return path;
}

const newPath = (projectId: string, folder: string, file: File) => `${projectId}/${folder}/${crypto.randomUUID()}.${fileExt(file.name)}`;

export const commsRepo = {
  async listMessages(projectId: string): Promise<Message[]> {
    const rows = (await must(sb().from("messages").select("*").eq("project_id", projectId).order("created_at"))) as Message[];
    const urls = await signUrls(
      MEDIA_BUCKET,
      rows.map((r) => r.attachment_path ?? ""),
    );
    return rows.map((r) => ({ ...r, attachment_url: r.attachment_path ? (urls.get(r.attachment_path) ?? null) : null }));
  },

  async sendMessage(projectId: string, body: string, file?: File | null): Promise<void> {
    const attachment_path = file ? await upload(MEDIA_BUCKET, newPath(projectId, "chat", file), file) : null;
    await must(
      sb()
        .from("messages")
        .insert({ project_id: projectId, sender_id: await currentUserId(), body, attachment_path }),
    );
  },

  async markChatRead(projectId: string): Promise<void> {
    await must(sb().rpc("mark_chat_read", { p_project: projectId }));
  },

  /** `postgres_changes` on `messages` for one project. Returns an unsubscribe function. */
  subscribeMessages(projectId: string, onChange: () => void): () => void {
    const ch = sb()
      .channel(`messages:${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `project_id=eq.${projectId}` }, onChange)
      .subscribe();
    return () => void sb().removeChannel(ch);
  },

  /**
   * Presence on `presence:project:<id>`. Channel name and tracked payload (`name`, `role`, `at`)
   * are shared with the client app — keep both exactly as they are. Returns an unsubscribe function.
   */
  joinPresence(projectId: string, me: PresenceMember, onChange: (onlineUserIds: string[]) => void): () => void {
    const ch = sb().channel(`presence:project:${projectId}`, { config: { presence: { key: me.id } } });
    ch.on("presence", { event: "sync" }, () => onChange(Object.keys(ch.presenceState()))).subscribe((status) => {
      if (status === "SUBSCRIBED") void ch.track({ name: me.name, role: me.role, at: new Date().toISOString() } satisfies PresencePayload);
    });
    return () => void sb().removeChannel(ch);
  },

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

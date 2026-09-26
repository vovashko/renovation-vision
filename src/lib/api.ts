import { supabase, INTERNAL_BUCKET, MEDIA_BUCKET } from "./supabase";
import { demoApi } from "./demo-api";
import { fileExt } from "./format";
import type {
  ActivityEntry,
  Expense,
  CrewMember,
  Knowledge,
  Member,
  Message,
  Notification,
  Photo,
  Project,
  ProjectInternal,
  ProjectRole,
  ProjectSummary,
  Render,
  Room,
  Stage,
  Task,
} from "./database.types";

export type ProjectPatch = Partial<
  Pick<Project, "name" | "address" | "client_name" | "start_date" | "target_date" | "budget" | "schedule_status" | "schedule_note">
>;
export type NewProject = { name: string; address: string; client_name: string; start_date: string | null; target_date: string | null; budget: number };
export type StageInput = Partial<Omit<Stage, "tasks" | "project_id">>;
export type TaskInput = Partial<Omit<Task, "project_id">> & { stage_id: string };
export type RoomInput = Partial<Omit<Room, "project_id">>;
export type PhotoMeta = { stage_id: string | null; room_id: string | null; caption: string };
export type PhotoPatch = Partial<Pick<Photo, "caption" | "alt" | "stage_id" | "room_id" | "status">>;
export type RenderInput = Partial<Omit<Render, "project_id" | "url" | "storage_path">> & { file?: File | null };
export type ExpenseInput = Partial<Omit<Expense, "project_id" | "receipt_path">> & { receiptFile?: File | null };
export type ClientContact = Pick<ProjectInternal, "client_phone" | "client_email">;
export type CrewInput = Partial<Omit<CrewMember, "project_id">>;
export type KnowledgeInput = Partial<Omit<Knowledge, "project_id" | "updated_at">>;
export type PresenceMember = { id: string; name: string; role: ProjectRole };

/** Everything the portal reads or writes. Backed by Supabase, or by an in-memory demo store. */
export type Api = {
  listProjects(): Promise<ProjectSummary[]>;
  createProject(input: NewProject): Promise<string>;
  getProject(id: string): Promise<ProjectSummary>;
  updateProject(id: string, patch: ProjectPatch): Promise<void>;
  getInternal(id: string): Promise<ProjectInternal>;
  updateInternal(id: string, notes: string): Promise<void>;
  updateClientContact(id: string, contact: ClientContact): Promise<void>;

  listCrew(id: string): Promise<CrewMember[]>;
  saveCrew(id: string, input: CrewInput): Promise<void>;
  deleteCrew(crewId: string): Promise<void>;

  listMembers(id: string): Promise<Member[]>;
  addMember(id: string, email: string, role: ProjectRole): Promise<void>;
  removeMember(id: string, userId: string): Promise<void>;

  listStages(id: string): Promise<Stage[]>;
  saveStage(id: string, input: StageInput): Promise<void>;
  deleteStage(stageId: string): Promise<void>;
  saveTask(id: string, input: TaskInput): Promise<void>;
  deleteTask(taskId: string): Promise<void>;

  listRooms(id: string): Promise<Room[]>;
  saveRoom(id: string, input: RoomInput): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;

  listPhotos(id: string): Promise<Photo[]>;
  uploadPhotos(id: string, files: File[], meta: PhotoMeta, publish: boolean): Promise<void>;
  updatePhoto(photoId: string, patch: PhotoPatch): Promise<void>;
  deletePhoto(photo: Photo): Promise<void>;

  listRenders(id: string): Promise<Render[]>;
  saveRender(id: string, input: RenderInput): Promise<void>;
  deleteRender(render: Render): Promise<void>;

  listExpenses(id: string): Promise<Expense[]>;
  saveExpense(id: string, input: ExpenseInput): Promise<void>;
  deleteExpense(expense: Expense): Promise<void>;
  receiptUrl(path: string): Promise<string>;

  listMessages(id: string): Promise<Message[]>;
  sendMessage(id: string, body: string, file?: File | null): Promise<void>;
  subscribeMessages(id: string, onChange: () => void): () => void;
  markChatRead(id: string): Promise<void>;
  joinPresence(id: string, me: PresenceMember, onChange: (onlineUserIds: string[]) => void): () => void;

  listNotifications(id: string): Promise<Notification[]>;
  notifyClients(id: string, title: string, body: string, link: string | null): Promise<void>;
  listActivity(id: string): Promise<ActivityEntry[]>;

  listKnowledge(id: string): Promise<Knowledge[]>;
  saveKnowledge(id: string, input: KnowledgeInput): Promise<void>;
  deleteKnowledge(knowledgeId: string): Promise<void>;
};

// ---------------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------------
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
  const data = await must(sb().storage.from(bucket).createSignedUrls(unique, 60 * 60));
  return new Map(data.filter((d) => d.signedUrl).map((d) => [d.path as string, d.signedUrl]));
}

async function upload(bucket: string, path: string, file: File) {
  await must(sb().storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false }));
  return path;
}

const newPath = (projectId: string, folder: string, file: File) => `${projectId}/${folder}/${crypto.randomUUID()}.${fileExt(file.name)}`;
const toNumber = <T extends Record<string, unknown>>(row: T, ...keys: (keyof T)[]) => {
  for (const k of keys) (row as Record<string, unknown>)[k as string] = Number(row[k]);
  return row;
};

const supabaseApi: Api = {
  async listProjects() {
    const rows = await must(sb().from("project_summary").select("*").order("name"));
    return (rows as ProjectSummary[]).map((r) => toNumber(r, "budget", "spent"));
  },
  async createProject(input) {
    return must(
      sb().rpc("create_project", {
        p_name: input.name,
        p_address: input.address,
        p_client_name: input.client_name,
        p_start_date: input.start_date,
        p_target_date: input.target_date,
        p_budget: input.budget,
      }),
    ) as Promise<string>;
  },
  async getProject(id) {
    const row = await must(sb().from("project_summary").select("*").eq("id", id).single());
    return toNumber(row as unknown as ProjectSummary, "budget", "spent");
  },
  async updateProject(id, patch) {
    await must(sb().from("projects").update(patch).eq("id", id));
  },
  async getInternal(id) {
    return must(sb().from("project_internal").select("*").eq("project_id", id).single()) as Promise<ProjectInternal>;
  },
  async updateInternal(id, notes) {
    await must(sb().from("project_internal").upsert({ project_id: id, internal_budget_notes: notes }));
  },
  async updateClientContact(id, contact) {
    await must(sb().from("project_internal").upsert({ project_id: id, ...contact }));
  },

  async listCrew(id) {
    return must(sb().from("project_crew").select("*").eq("project_id", id).order("sort_order").order("created_at")) as Promise<CrewMember[]>;
  },
  async saveCrew(id, { id: crewId, ...input }) {
    if (crewId) await must(sb().from("project_crew").update(input).eq("id", crewId));
    else await must(sb().from("project_crew").insert({ ...input, project_id: id }));
  },
  async deleteCrew(crewId) {
    await must(sb().from("project_crew").delete().eq("id", crewId));
  },

  async listMembers(id) {
    return must(
      sb().from("project_members").select("*, profile:profiles(id, full_name, avatar_url)").eq("project_id", id).order("created_at"),
    ) as Promise<Member[]>;
  },
  async addMember(id, email, role) {
    await must(sb().rpc("add_project_member", { p_project: id, p_email: email, p_role: role }));
  },
  async removeMember(id, userId) {
    await must(sb().from("project_members").delete().eq("project_id", id).eq("user_id", userId));
  },

  async listStages(id) {
    return must(
      sb().from("stages").select("*, tasks(*)").eq("project_id", id).order("sort_order").order("sort_order", { referencedTable: "tasks" }),
    ) as Promise<Stage[]>;
  },
  async saveStage(id, { id: stageId, ...input }) {
    if (stageId) await must(sb().from("stages").update(input).eq("id", stageId));
    else await must(sb().from("stages").insert({ ...input, project_id: id }));
  },
  async deleteStage(stageId) {
    await must(sb().from("stages").delete().eq("id", stageId));
  },
  async saveTask(id, { id: taskId, ...input }) {
    if (taskId) await must(sb().from("tasks").update(input).eq("id", taskId));
    else await must(sb().from("tasks").insert({ ...input, project_id: id }));
  },
  async deleteTask(taskId) {
    await must(sb().from("tasks").delete().eq("id", taskId));
  },

  async listRooms(id) {
    return must(sb().from("rooms").select("*").eq("project_id", id).order("sort_order")) as Promise<Room[]>;
  },
  async saveRoom(id, { id: roomId, ...input }) {
    if (roomId) await must(sb().from("rooms").update(input).eq("id", roomId));
    else await must(sb().from("rooms").insert({ ...input, project_id: id }));
  },
  async deleteRoom(roomId) {
    await must(sb().from("rooms").delete().eq("id", roomId));
  },

  async listPhotos(id) {
    const rows = (await must(sb().from("photos").select("*").eq("project_id", id).order("taken_at", { ascending: false }))) as Photo[];
    const urls = await signUrls(MEDIA_BUCKET, rows.map((r) => r.storage_path));
    return rows.map((r) => ({ ...r, url: urls.get(r.storage_path) ?? "" }));
  },
  async uploadPhotos(id, files, meta, publish) {
    const uid = await currentUserId();
    const now = new Date().toISOString();
    for (const file of files) {
      const path = await upload(MEDIA_BUCKET, newPath(id, "photos", file), file);
      await must(
        sb().from("photos").insert({
          project_id: id,
          storage_path: path,
          stage_id: meta.stage_id,
          room_id: meta.room_id,
          caption: meta.caption,
          alt: meta.caption || file.name,
          uploaded_by: uid,
          status: publish ? "published" : "draft",
          published_at: publish ? now : null,
        }),
      );
    }
  },
  async updatePhoto(photoId, patch) {
    const extra = patch.status === "published" ? { published_at: new Date().toISOString() } : patch.status === "draft" ? { published_at: null } : {};
    await must(sb().from("photos").update({ ...patch, ...extra }).eq("id", photoId));
  },
  async deletePhoto(photo) {
    await must(sb().from("photos").delete().eq("id", photo.id));
    await sb().storage.from(MEDIA_BUCKET).remove([photo.storage_path]);
  },

  async listRenders(id) {
    const rows = (await must(sb().from("renders").select("*").eq("project_id", id).order("sort_order"))) as Render[];
    const urls = await signUrls(MEDIA_BUCKET, rows.map((r) => r.storage_path));
    return rows.map((r) => ({ ...r, url: urls.get(r.storage_path) ?? "" }));
  },
  async saveRender(id, { id: renderId, file, ...input }) {
    const storage_path = file ? await upload(MEDIA_BUCKET, newPath(id, "renders", file), file) : undefined;
    if (renderId) await must(sb().from("renders").update({ ...input, ...(storage_path ? { storage_path } : {}) }).eq("id", renderId));
    else {
      if (!storage_path) throw new Error("Choose an image for the render");
      await must(sb().from("renders").insert({ ...input, storage_path, project_id: id }));
    }
  },
  async deleteRender(render) {
    await must(sb().from("renders").delete().eq("id", render.id));
    await sb().storage.from(MEDIA_BUCKET).remove([render.storage_path]);
  },

  async listExpenses(id) {
    const rows = (await must(sb().from("expenses").select("*").eq("project_id", id).order("spent_on", { ascending: false }))) as Expense[];
    return rows.map((r) => toNumber(r, "amount"));
  },
  async saveExpense(id, { id: expenseId, receiptFile, ...input }) {
    const receipt_path = receiptFile ? await upload(INTERNAL_BUCKET, newPath(id, "receipts", receiptFile), receiptFile) : undefined;
    const row = { ...input, ...(receipt_path ? { receipt_path } : {}) };
    if (expenseId) await must(sb().from("expenses").update(row).eq("id", expenseId));
    else await must(sb().from("expenses").insert({ ...row, project_id: id, created_by: await currentUserId() }));
  },
  async deleteExpense(expense) {
    await must(sb().from("expenses").delete().eq("id", expense.id));
    if (expense.receipt_path) await sb().storage.from(INTERNAL_BUCKET).remove([expense.receipt_path]);
  },
  async receiptUrl(path) {
    const data = await must(sb().storage.from(INTERNAL_BUCKET).createSignedUrl(path, 60 * 10));
    return data.signedUrl;
  },

  async listMessages(id) {
    const rows = (await must(sb().from("messages").select("*").eq("project_id", id).order("created_at"))) as Message[];
    const urls = await signUrls(MEDIA_BUCKET, rows.map((r) => r.attachment_path ?? ""));
    return rows.map((r) => ({ ...r, attachment_url: r.attachment_path ? urls.get(r.attachment_path) ?? null : null }));
  },
  async sendMessage(id, body, file) {
    const attachment_path = file ? await upload(MEDIA_BUCKET, newPath(id, "chat", file), file) : null;
    await must(sb().from("messages").insert({ project_id: id, sender_id: await currentUserId(), body, attachment_path }));
  },
  subscribeMessages(id, onChange) {
    const ch = sb()
      .channel(`messages:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `project_id=eq.${id}` }, onChange)
      .subscribe();
    return () => void sb().removeChannel(ch);
  },
  async markChatRead(id) {
    await must(sb().rpc("mark_chat_read", { p_project: id }));
  },
  joinPresence(id, me, onChange) {
    // Channel name and payload are shared with the client app (see README: Client app integration notes).
    const ch = sb().channel(`presence:project:${id}`, { config: { presence: { key: me.id } } });
    ch.on("presence", { event: "sync" }, () => onChange(Object.keys(ch.presenceState())))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void ch.track({ name: me.name, role: me.role, at: new Date().toISOString() });
      });
    return () => void sb().removeChannel(ch);
  },

  async listNotifications(id) {
    return must(
      sb().from("notifications").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(300),
    ) as Promise<Notification[]>;
  },
  async notifyClients(id, title, body, link) {
    await must(sb().rpc("notify_project_clients", { p_project: id, p_title: title, p_body: body, p_link: link }));
  },
  async listActivity(id) {
    return must(
      sb().from("activity_log").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(200),
    ) as Promise<ActivityEntry[]>;
  },

  async listKnowledge(id) {
    return must(sb().from("ai_knowledge").select("*").eq("project_id", id).order("created_at")) as Promise<Knowledge[]>;
  },
  async saveKnowledge(id, { id: kId, ...input }) {
    if (kId) await must(sb().from("ai_knowledge").update(input).eq("id", kId));
    else await must(sb().from("ai_knowledge").insert({ ...input, project_id: id, created_by: await currentUserId() }));
  },
  async deleteKnowledge(kId) {
    await must(sb().from("ai_knowledge").delete().eq("id", kId));
  },
};

export const api: Api = supabase ? supabaseApi : demoApi;

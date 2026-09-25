/**
 * Demo mode: an in-memory copy of supabase/seed.sql, used when no Supabase
 * env vars are set. It applies the same integrity rules as the database
 * triggers (room/task guards, spent total, activity log, client notifications)
 * so the portal behaves the same way. Nothing is persisted.
 */
import photoDemo from "@/assets/photo-demo.jpg";
import photoWiring from "@/assets/photo-wiring.jpg";
import photoDrywall from "@/assets/photo-drywall.jpg";
import photoFlooring from "@/assets/photo-flooring.jpg";
import renderLiving from "@/assets/render-living.jpg";
import renderKitchen from "@/assets/render-kitchen.jpg";
import renderBath from "@/assets/render-bath.jpg";
import renderBedroom from "@/assets/render-bedroom.jpg";
import { statusLabel, type Status } from "@/components/ui/status";
import type { Api } from "./api";
import type {
  ActivityEntry,
  Expense,
  Knowledge,
  Member,
  Message,
  Notification,
  Photo,
  Project,
  ProjectSummary,
  Render,
  Room,
  Stage,
  Task,
} from "./database.types";

export const DEMO_USER = { id: "a0000000-0000-4000-8000-000000000001", full_name: "Jonas Weber", email: "jonas@renotrack.demo" };
const SARAH = "a0000000-0000-4000-8000-000000000002";
const TOM = "a0000000-0000-4000-8000-000000000003";
const PID = "b0000000-0000-4000-8000-000000000001";
const CLIENTS = [SARAH, TOM];

const files: Record<string, string> = {
  "p1-living-drywall.jpg": photoDrywall,
  "p2-bed1-subfloor.jpg": photoFlooring,
  "p3-dining-drywall.jpg": photoDrywall,
  "p4-bed1-leveling.jpg": photoFlooring,
  "p5-bed2-wiring.jpg": photoWiring,
  "p6-kitchen-panel.jpg": photoWiring,
  "p7-living-demo.jpg": photoDemo,
  "p8-dining-demo.jpg": photoDemo,
  "p9-bed2-junction-draft.jpg": photoWiring,
  "r1-living.jpg": renderLiving,
  "r2-kitchen.jpg": renderKitchen,
  "r3-bath.jpg": renderBath,
  "r4-bedroom.jpg": renderBedroom,
};
const objectUrls = new Map<string, string>();
const urlFor = (path: string) => objectUrls.get(path) ?? files[path.split("/").pop() ?? ""] ?? "";

const ts = "2026-04-20T12:00:00";
const sid = (n: number) => `c0000000-0000-4000-8000-00000000000${n}`;
const rid = (n: number) => `d0000000-0000-4000-8000-00000000000${n}`;
const pid = (n: number) => `e0000000-0000-4000-8000-00000000000${n}`;

type State = {
  project: Project;
  internal: string;
  members: Member[];
  rooms: Room[];
  stages: Omit<Stage, "tasks">[];
  tasks: Task[];
  photos: Omit<Photo, "url">[];
  renders: Omit<Render, "url">[];
  expenses: Expense[];
  messages: Message[];
  notifications: Notification[];
  activity: ActivityEntry[];
  knowledge: Knowledge[];
};

function seed(): State {
  const room = (n: number, key: string, name: string, status: Status, progress: number, x: number, y: number, w: number, h: number, client_note: string): Room => ({
    id: rid(n), project_id: PID, key, name, status, progress, x, y, w, h, client_note, sort_order: n, is_visible: true,
  });
  const stage = (n: number, key: string, name: string, status: Status, progress: number, start_date: string, end_date: string): Omit<Stage, "tasks"> => ({
    id: sid(n), project_id: PID, key, name, status, progress, start_date, end_date, client_note: "", sort_order: n, is_visible: true,
  });
  const taskRows: [number, string | null, string, boolean][] = [
    [1, null, "Remove old flooring", true], [1, rid(1), "Tear down partition wall", true], [1, null, "Dispose debris", true],
    [2, rid(2), "New circuit panel", true], [2, rid(4), "Re-route bathroom plumbing", true], [2, null, "Inspection sign-off", true],
    [3, rid(1), "Drywall living room", true], [3, null, "Insulate exterior walls", true], [3, null, "Tape & mud", false], [3, null, "Prime walls", false],
    [4, null, "Subfloor leveling", true], [4, null, "Install oak planks", false], [4, rid(4), "Bathroom tiling", false],
    [5, rid(2), "Cabinet delivery", false], [5, rid(2), "Countertop template", false], [5, rid(2), "Appliance hookup", false],
    [6, null, "Ceiling paint", false], [6, null, "Wall color coats", false], [6, null, "Trim & doors", false],
    [7, null, "Walkthrough with client", false],
  ];
  const order: Record<number, number> = {};
  const photo = (n: number, file: string, stage: number, roomN: number, alt: string, caption: string, taken_at: string, status: "draft" | "published" = "published"): Omit<Photo, "url"> => ({
    id: pid(n), project_id: PID, stage_id: sid(stage), room_id: rid(roomN), storage_path: `${PID}/photos/${file}`, alt, caption, taken_at,
    uploaded_by: DEMO_USER.id, status, published_at: status === "published" ? taken_at : null,
  });
  const exp = (n: number, stage: number, category: string, description: string, vendor: string, vendor_notes: string, amount: number, spent_on: string): Expense => ({
    id: `x${n}`, project_id: PID, stage_id: sid(stage), category, description, vendor, vendor_notes, amount, spent_on, receipt_path: null,
  });
  const note = (i: number, recipient: string, kind: string, title: string, body: string, link: string, created_at: string, read: boolean): Notification => ({
    id: `n${i}-${recipient.slice(-1)}`, project_id: PID, recipient_id: recipient, kind, title, body, link, created_at, read_at: read ? created_at : null,
  });
  const notes = [
    ["room", "Bedroom 2 is now blocked", "Waiting on the electrical inspector to sign off the new circuit before the walls can be closed.", "/plan", "2026-04-17T14:25:00", true],
    ["stage", "Stage update: Flooring", "Flooring is now in progress.", "/stages", "2026-04-18T08:00:00", true],
    ["photo", "New site photo", "Subfloor leveled in Bedroom 1. Oak planks acclimatising before install.", "/photos", "2026-04-20T08:45:00", true],
    ["photo", "New site photo", "Drywall finished in the living room — taping started this morning.", "/photos", "2026-04-20T10:15:00", false],
    ["schedule", "Schedule: At risk", "Bedroom 2 is blocked until the electrical inspector signs off the new circuit. The Jun 10 target still holds if sign-off arrives this week.", "/", "2026-04-20T11:00:00", false],
  ] as const;
  const act = (id: number, entity_type: string, summary: string, changes: ActivityEntry["changes"], created_at: string): ActivityEntry => ({
    id, project_id: PID, actor_id: DEMO_USER.id, action: summary.startsWith("Added") ? "insert" : "update", entity_type, entity_id: null, summary, changes, created_at,
  });
  const k = (n: number, title: string, content: string, tags: string[], is_visible: boolean): Knowledge => ({ id: `k${n}`, project_id: PID, title, content, tags, is_visible, updated_at: ts });

  return {
    project: {
      id: PID, name: "Maple Street Apartment", address: "42 Maple Street, Apt 5B", client_name: "Sarah & Tom Bennett",
      start_date: "2026-03-02", target_date: "2026-06-10", budget: 84500, spent: 51200, schedule_status: "at_risk",
      schedule_note: "Bedroom 2 is blocked until the electrical inspector signs off the new circuit. The Jun 10 target still holds if sign-off arrives this week.",
      created_at: ts, updated_at: ts,
    },
    internal:
      "Contingency: $4,000 held for Bedroom 2 rework if the circuit fails inspection.\nKitchen cabinets quote $14,800 — 30% deposit due May 1.\nKeep margin at or above 12%; oak planks came in $350 under quote.",
    members: [
      { project_id: PID, user_id: DEMO_USER.id, role: "manager", last_read_at: "2026-04-20T09:25:00", created_at: ts, profile: { id: DEMO_USER.id, full_name: "Jonas Weber", avatar_url: null } },
      { project_id: PID, user_id: SARAH, role: "client", last_read_at: "2026-04-20T09:25:00", created_at: ts, profile: { id: SARAH, full_name: "Sarah Bennett", avatar_url: null } },
      { project_id: PID, user_id: TOM, role: "client", last_read_at: "2026-04-19T18:00:00", created_at: ts, profile: { id: TOM, full_name: "Tom Bennett", avatar_url: null } },
    ],
    rooms: [
      room(1, "living", "Living Room", "progress", 60, 20, 20, 320, 220, "Drywall finished; taping and priming this week."),
      room(2, "kitchen", "Kitchen", "pending", 10, 340, 20, 240, 140, "New circuit panel in place. Cabinets arrive for the Kitchen Install stage."),
      room(3, "dining", "Dining", "progress", 45, 340, 160, 240, 80, "Walls boarded and insulated."),
      room(4, "bath", "Bathroom", "progress", 80, 20, 240, 160, 160, "Plumbing re-routed and signed off. Tiling follows with the flooring stage."),
      room(5, "bed1", "Bedroom 1", "progress", 35, 180, 240, 200, 160, "Subfloor levelled; oak planks acclimatising."),
      room(6, "bed2", "Bedroom 2", "blocked", 15, 380, 240, 200, 160, "Waiting on the electrical inspector to sign off the new circuit before the walls can be closed."),
    ],
    stages: [
      stage(1, "demo", "Demolition", "done", 100, "2026-03-02", "2026-03-14"),
      stage(2, "elec", "Electrical & Plumbing", "done", 100, "2026-03-15", "2026-04-02"),
      stage(3, "wall", "Walls & Insulation", "progress", 65, "2026-04-03", "2026-04-24"),
      stage(4, "floor", "Flooring", "progress", 20, "2026-04-18", "2026-05-08"),
      stage(5, "kitch", "Kitchen Install", "pending", 0, "2026-05-09", "2026-05-22"),
      stage(6, "paint", "Painting & Finishes", "pending", 0, "2026-05-23", "2026-06-05"),
      stage(7, "final", "Final Inspection", "pending", 0, "2026-06-06", "2026-06-10"),
    ],
    tasks: taskRows.map(([s, room_id, name, done], i) => ({
      id: `t${i + 1}`, project_id: PID, stage_id: sid(s), room_id, name, done, sort_order: (order[s] = (order[s] ?? 0) + 1), is_visible: true,
    })),
    photos: [
      photo(1, "p1-living-drywall.jpg", 3, 1, "Living room with fresh drywall panels and taped seams", "Drywall finished in the living room — taping started this morning.", "2026-04-20T10:12:00"),
      photo(2, "p2-bed1-subfloor.jpg", 4, 5, "Bedroom subfloor freshly leveled with oak planks stacked nearby", "Subfloor leveled in Bedroom 1. Oak planks acclimatising before install.", "2026-04-20T08:40:00"),
      photo(3, "p3-dining-drywall.jpg", 3, 3, "Dining area walls boarded with drywall", "Dining walls boarded and insulated behind the panels.", "2026-04-19T16:05:00"),
      photo(4, "p4-bed1-leveling.jpg", 4, 5, "Self-leveling compound drying on a bedroom floor", "Levelling compound curing — ready for planks in 48h.", "2026-04-19T11:30:00"),
      photo(5, "p5-bed2-wiring.jpg", 3, 6, "Open stud wall in Bedroom 2 with new wiring awaiting inspection", "Bedroom 2 walls stay open until the electrical inspector signs off the new circuit.", "2026-04-17T14:20:00"),
      photo(6, "p6-kitchen-panel.jpg", 2, 2, "New circuit panel installed between wooden studs", "New circuit panel installed and labelled.", "2026-03-28T09:50:00"),
      photo(7, "p7-living-demo.jpg", 1, 1, "Living room during demolition with old flooring torn up", "Partition wall removed — living and dining now open plan.", "2026-03-10T15:00:00"),
      photo(8, "p8-dining-demo.jpg", 1, 3, "Old flooring pieces scattered across the dining area", "Old flooring lifted in the dining area.", "2026-03-06T10:00:00"),
      photo(9, "p9-bed2-junction-draft.jpg", 3, 6, "Close-up of a junction box in Bedroom 2", "Junction box relocated for the inspector — check spacing before publishing.", "2026-04-20T11:05:00", "draft"),
    ],
    renders: [
      { id: "f1", project_id: PID, room_id: rid(1), storage_path: `${PID}/renders/r1-living.jpg`, alt: "Render of the finished living room with oak floors and linen sofa", title: "Open living space", description: "Oak plank floors, soft white walls, linen sofa with terracotta accents.", compare_photo_id: pid(1), sort_order: 1, is_visible: true },
      { id: "f2", project_id: PID, room_id: rid(2), storage_path: `${PID}/renders/r2-kitchen.jpg`, alt: "Render of the finished kitchen with matte white cabinets", title: "Kitchen & island", description: "Matte white cabinets, oak open shelving, quartz worktops, brass fixtures.", compare_photo_id: null, sort_order: 2, is_visible: true },
      { id: "f3", project_id: PID, room_id: rid(4), storage_path: `${PID}/renders/r3-bath.jpg`, alt: "Render of the finished bathroom with sage green tiles", title: "Bathroom", description: "Sage zellige tiles, walk-in shower, oak vanity, matte black taps.", compare_photo_id: null, sort_order: 3, is_visible: true },
      { id: "f4", project_id: PID, room_id: rid(5), storage_path: `${PID}/renders/r4-bedroom.jpg`, alt: "Render of the finished bedroom with oak floor and warm beige walls", title: "Bedroom 1", description: "Oak floor, warm beige walls, linen bedding, restored radiator.", compare_photo_id: null, sort_order: 4, is_visible: true },
    ],
    expenses: [
      exp(1, 1, "Labour", "Demolition crew (2 weeks)", "Hansen Demolition", "Fixed price. Invoice paid on completion.", 6800, "2026-03-14"),
      exp(2, 1, "Disposal", "Skip hire and debris disposal", "CityWaste", "Two skips; second one was a same-day swap.", 950, "2026-03-12"),
      exp(3, 2, "Labour", "New circuit panel and rewiring", "Brightline Electric", "Contact: Marek (+1 555 0142). Re-inspection of Bedroom 2 circuit included in price.", 12400, "2026-04-02"),
      exp(4, 2, "Labour", "Bathroom plumbing re-route", "FlowRight Plumbing", "Warranty 5 years on new runs. Ask for pressure-test certificate.", 8900, "2026-03-30"),
      exp(5, 2, "Permits", "Electrical permit and inspection fees", "City Building Dept.", "Inspection #EL-2291. Follow-up slot requested for Bedroom 2.", 1250, "2026-03-16"),
      exp(6, 3, "Materials", "Drywall boards and insulation", "BuildMart", "Trade account discount 8%. Leftover boards returnable until May 15.", 7300, "2026-04-04"),
      exp(7, 3, "Labour", "Drywall installation", "Hansen Demolition", "Same crew as demolition; day rate $700.", 5600, "2026-04-17"),
      exp(8, 4, "Materials", "Oak planks (68 m²)", "Nordic Oak Supply", "Came in $350 under quote. Keep 2 spare boxes for repairs.", 6450, "2026-04-19"),
      exp(9, 4, "Materials", "Levelling compound and subfloor prep", "BuildMart", "", 1550, "2026-04-18"),
    ],
    messages: [
      { id: "m1", project_id: PID, sender_id: DEMO_USER.id, body: "Hi! Quick update — drywall is done in the living room. We're starting flooring tomorrow.", attachment_path: null, created_at: "2026-04-20T09:14:00" },
      { id: "m2", project_id: PID, sender_id: SARAH, body: "Great news! Did the oak planks arrive?", attachment_path: null, created_at: "2026-04-20T09:18:00" },
      { id: "m3", project_id: PID, sender_id: DEMO_USER.id, body: "Yes, delivered this morning. Quality looks excellent.", attachment_path: null, created_at: "2026-04-20T09:20:00" },
      { id: "m4", project_id: PID, sender_id: DEMO_USER.id, body: "Heads up: Bedroom 2 is blocked — waiting on the electrical inspector. Will follow up today.", attachment_path: null, created_at: "2026-04-20T09:21:00" },
      { id: "m5", project_id: PID, sender_id: SARAH, body: "Thanks Jonas, keep me posted.", attachment_path: null, created_at: "2026-04-20T09:25:00" },
    ],
    notifications: [
      ...notes.flatMap(([kind, title, body, link, at, read], i) => CLIENTS.map((c) => note(i, c, kind, title, body, link, at, read))),
      note(9, DEMO_USER.id, "message", "New message from Sarah Bennett", "Thanks Jonas, keep me posted.", "/chat", "2026-04-20T09:25:00", true),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    activity: [
      act(7, "projects", 'Updated project "Maple Street Apartment"', { schedule_status: { from: "on_schedule", to: "at_risk" } }, "2026-04-20T11:00:00"),
      act(6, "rooms", 'Updated room "Bathroom"', { status: { from: "done", to: "progress" }, progress: { from: 100, to: 80 } }, "2026-04-20T10:40:00"),
      act(5, "photos", 'Added photo "Drywall finished in the living room — taping started this morning."', {}, "2026-04-20T10:15:00"),
      act(4, "expenses", 'Added expense "Oak planks (68 m²)"', {}, "2026-04-19T17:40:00"),
      act(3, "stages", 'Updated stage "Flooring"', { status: { from: "pending", to: "progress" } }, "2026-04-18T08:00:00"),
      act(2, "rooms", 'Updated room "Bedroom 2"', { status: { from: "progress", to: "blocked" } }, "2026-04-17T14:25:00"),
      act(1, "stages", 'Updated stage "Electrical & Plumbing"', { status: { from: "progress", to: "done" }, progress: { from: 90, to: 100 } }, "2026-04-02T17:10:00"),
    ],
    knowledge: [
      k(1, "Why is Bedroom 2 blocked?", "The new circuit in Bedroom 2 needs the electrical inspector's sign-off before the walls can be closed. The inspection is requested and Jonas follows up daily. Nothing else in the apartment is waiting on it.", ["bedroom 2", "blocked", "electrical"], true),
      k(2, "Site working hours", "The crew is on site Monday to Friday, 7:30–16:30. Noisy work (cutting, drilling) starts after 9:00.", ["schedule", "hours"], true),
      k(3, "Oak flooring", "The oak planks were delivered on Apr 20 and acclimatise for 48 hours before install. Two spare boxes are kept for future repairs.", ["flooring", "oak"], true),
      k(4, "Kitchen cabinets", "Cabinets are delivered at the start of the Kitchen Install stage (May 9). The countertop is templated once the cabinets are fixed.", ["kitchen"], true),
      k(5, "Cabinet supplier fallback (internal)", "If the cabinet delivery slips past May 12, switch to the Hallmark stock range — 10 days lead time, $900 more.", ["kitchen", "internal"], false),
    ],
  };
}

let db = seed();
const messageListeners = new Set<() => void>();
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));
const now = () => new Date().toISOString();
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120));

function fail(message: string): never {
  throw new Error(message);
}

function log(entity_type: string, summary: string, changes: ActivityEntry["changes"] = {}) {
  db.activity.unshift({
    id: (db.activity[0]?.id ?? 0) + 1, project_id: PID, actor_id: DEMO_USER.id,
    action: summary.startsWith("Added") ? "insert" : summary.startsWith("Removed") ? "delete" : "update",
    entity_type, entity_id: null, summary, changes, created_at: now(),
  });
}

function diff<T extends object>(before: T, after: T) {
  const out: ActivityEntry["changes"] = {};
  for (const k of Object.keys(after) as (keyof T)[]) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) out[k as string] = { from: before[k], to: after[k] };
  }
  return out;
}

function notify(kind: string, title: string, body: string, link: string | null, recipients = CLIENTS) {
  const at = now();
  for (const r of recipients) {
    db.notifications.unshift({ id: uid(), project_id: PID, recipient_id: r, kind, title, body, link, created_at: at, read_at: null });
  }
}

function checkDone(status: Status, progress: number, what: string) {
  if ((status === "done") !== (progress === 100)) fail(`${what}: "Completed" and 100% must go together.`);
}

function summary(): ProjectSummary {
  const s = db.stages;
  return {
    ...db.project,
    overall_progress: s.length ? Math.round(s.reduce((a, x) => a + x.progress, 0) / s.length) : 0,
    stages_done: s.filter((x) => x.status === "done").length,
    stages_total: s.length,
    current_stage: [...s].sort((a, b) => a.sort_order - b.sort_order).find((x) => x.status === "progress")?.name ?? null,
    manager_name: "Jonas Weber",
  };
}

function refreshSpent() {
  db.project.spent = db.expenses.reduce((a, e) => a + e.amount, 0);
}

export const demoApi: Api = {
  listProjects: () => wait([summary()]),
  async createProject() {
    fail("Creating projects needs a Supabase connection. The demo has one project.");
  },
  getProject: (id) => (id === PID ? wait(summary()) : Promise.reject(new Error("Project not found"))),
  async updateProject(_id, patch) {
    const before = { ...db.project };
    db.project = { ...db.project, ...patch, updated_at: now() };
    const changes = diff(before, db.project);
    delete changes.updated_at;
    log("projects", `Updated project "${db.project.name}"`, changes);
    if (patch.schedule_status && patch.schedule_status !== before.schedule_status) {
      const label = { on_schedule: "On schedule", at_risk: "At risk", delayed: "Delayed" }[patch.schedule_status];
      notify("schedule", `Schedule: ${label}`, db.project.schedule_note, "/");
    }
  },
  getInternal: (id) => wait({ project_id: id, internal_budget_notes: db.internal, updated_at: ts }),
  async updateInternal(_id, notes) {
    db.internal = notes;
    log("project_internal", "Updated internal notes");
  },

  listMembers: () => wait(db.members),
  async addMember() {
    fail("Inviting people needs a Supabase connection.");
  },
  async removeMember(_id, userId) {
    const m = db.members.find((x) => x.user_id === userId);
    if (m?.role === "manager" && db.members.filter((x) => x.role === "manager").length === 1) fail("A project needs at least one manager");
    db.members = db.members.filter((x) => x.user_id !== userId);
    log("project_members", `Removed member "${m?.profile.full_name}"`);
  },

  listStages: () =>
    wait(
      [...db.stages]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({ ...s, tasks: db.tasks.filter((t) => t.stage_id === s.id).sort((a, b) => a.sort_order - b.sort_order) })),
    ),
  async saveStage(_id, input) {
    const existing = db.stages.find((s) => s.id === input.id);
    if (existing) {
      const next = { ...existing, ...input };
      checkDone(next.status, next.progress, next.name);
      if (next.end_date < next.start_date) fail("End date must be on or after the start date.");
      const changes = diff(existing, next);
      const statusChanged = existing.status !== next.status;
      Object.assign(existing, next);
      log("stages", `Updated stage "${next.name}"`, changes);
      if (statusChanged && next.is_visible) {
        notify("stage", `Stage update: ${next.name}`, `${next.name} is now ${statusLabel[next.status].toLowerCase()}.`, "/stages");
      }
    } else {
      const s: Omit<Stage, "tasks"> = {
        id: uid(), project_id: PID, key: input.key ?? uid().slice(0, 6), name: input.name ?? "New stage", status: input.status ?? "pending",
        progress: input.progress ?? 0, start_date: input.start_date ?? "2026-06-01", end_date: input.end_date ?? "2026-06-07",
        client_note: input.client_note ?? "", sort_order: input.sort_order ?? db.stages.length + 1, is_visible: input.is_visible ?? true,
      };
      checkDone(s.status, s.progress, s.name);
      db.stages.push(s);
      log("stages", `Added stage "${s.name}"`);
    }
  },
  async deleteStage(stageId) {
    const s = db.stages.find((x) => x.id === stageId);
    db.stages = db.stages.filter((x) => x.id !== stageId);
    db.tasks = db.tasks.filter((t) => t.stage_id !== stageId);
    log("stages", `Removed stage "${s?.name}"`);
  },
  async saveTask(_id, input) {
    const existing = db.tasks.find((t) => t.id === input.id);
    const next: Task = existing
      ? { ...existing, ...input }
      : { id: uid(), project_id: PID, room_id: null, name: "New task", done: false, sort_order: db.tasks.length + 1, is_visible: true, ...input };
    const room = db.rooms.find((r) => r.id === next.room_id);
    if (room?.status === "done" && !next.done) fail("Room is marked Completed — change its status before adding or re-opening tasks");
    const changes = existing ? diff(existing, next) : {};
    if (existing) Object.assign(existing, next);
    else db.tasks.push(next);
    log("tasks", `${existing ? "Updated" : "Added"} task "${next.name}"`, changes);
  },
  async deleteTask(taskId) {
    const t = db.tasks.find((x) => x.id === taskId);
    db.tasks = db.tasks.filter((x) => x.id !== taskId);
    log("tasks", `Removed task "${t?.name}"`);
  },

  listRooms: () => wait([...db.rooms].sort((a, b) => a.sort_order - b.sort_order)),
  async saveRoom(_id, input) {
    const existing = db.rooms.find((r) => r.id === input.id);
    const next: Room = existing
      ? { ...existing, ...input }
      : { id: uid(), project_id: PID, key: "room", name: "New room", status: "pending", progress: 0, x: 20, y: 20, w: 160, h: 120, client_note: "", sort_order: db.rooms.length + 1, is_visible: true, ...input };
    checkDone(next.status, next.progress, next.name);
    if (next.status === "done") {
      const open = db.tasks.filter((t) => t.room_id === next.id && !t.done).map((t) => t.name);
      if (open.length) fail(`${next.name} cannot be marked Completed while tasks are open: ${open.join(", ")}`);
    }
    if (existing) {
      const changes = diff(existing, next);
      const statusChanged = existing.status !== next.status;
      Object.assign(existing, next);
      log("rooms", `Updated room "${next.name}"`, changes);
      if (statusChanged && next.is_visible) notify("room", `${next.name} is now ${statusLabel[next.status].toLowerCase()}`, next.client_note, "/plan");
    } else {
      db.rooms.push(next);
      log("rooms", `Added room "${next.name}"`);
    }
  },
  async deleteRoom(roomId) {
    const r = db.rooms.find((x) => x.id === roomId);
    db.rooms = db.rooms.filter((x) => x.id !== roomId);
    db.tasks.forEach((t) => t.room_id === roomId && (t.room_id = null));
    log("rooms", `Removed room "${r?.name}"`);
  },

  listPhotos: () => wait([...db.photos].sort((a, b) => b.taken_at.localeCompare(a.taken_at)).map((p) => ({ ...p, url: urlFor(p.storage_path) }))),
  async uploadPhotos(_id, files, meta, publish) {
    for (const f of files) {
      const path = `${PID}/photos/${uid()}-${f.name}`;
      objectUrls.set(path, URL.createObjectURL(f));
      const at = now();
      db.photos.push({ id: uid(), project_id: PID, storage_path: path, stage_id: meta.stage_id, room_id: meta.room_id, caption: meta.caption, alt: meta.caption || f.name, taken_at: at, uploaded_by: DEMO_USER.id, status: publish ? "published" : "draft", published_at: publish ? at : null });
      log("photos", `Added photo "${meta.caption || f.name}"`);
      if (publish) notify("photo", "New site photo", meta.caption, "/photos");
    }
  },
  async updatePhoto(photoId, patch) {
    const p = db.photos.find((x) => x.id === photoId) ?? fail("Photo not found");
    const publishing = patch.status === "published" && p.status !== "published";
    Object.assign(p, patch, patch.status ? { published_at: patch.status === "published" ? now() : null } : {});
    log("photos", `Updated photo "${p.caption}"`, patch.status ? { status: { from: publishing ? "draft" : "published", to: patch.status } } : {});
    if (publishing) notify("photo", "New site photo", p.caption, "/photos");
  },
  async deletePhoto(photo) {
    db.photos = db.photos.filter((x) => x.id !== photo.id);
    db.renders.forEach((r) => r.compare_photo_id === photo.id && (r.compare_photo_id = null));
    log("photos", `Removed photo "${photo.caption}"`);
  },

  listRenders: () => wait([...db.renders].sort((a, b) => a.sort_order - b.sort_order).map((r) => ({ ...r, url: urlFor(r.storage_path) }))),
  async saveRender(_id, { file, ...input }) {
    let storage_path: string | undefined;
    if (file) {
      storage_path = `${PID}/renders/${uid()}-${file.name}`;
      objectUrls.set(storage_path, URL.createObjectURL(file));
    }
    const existing = db.renders.find((r) => r.id === input.id);
    if (existing) {
      const becameVisible = input.is_visible && !existing.is_visible;
      Object.assign(existing, input, storage_path ? { storage_path } : {});
      log("renders", `Updated render "${existing.title}"`);
      if (becameVisible) notify("render", `New design render: ${existing.title}`, existing.description, "/design");
    } else {
      if (!storage_path) fail("Choose an image for the render");
      const r: Omit<Render, "url"> = { id: uid(), project_id: PID, room_id: null, alt: "", title: "", description: "", compare_photo_id: null, sort_order: db.renders.length + 1, is_visible: false, ...input, storage_path };
      db.renders.push(r);
      log("renders", `Added render "${r.title}"`);
      if (r.is_visible) notify("render", `New design render: ${r.title}`, r.description, "/design");
    }
  },
  async deleteRender(render) {
    db.renders = db.renders.filter((x) => x.id !== render.id);
    log("renders", `Removed render "${render.title}"`);
  },

  listExpenses: () => wait([...db.expenses].sort((a, b) => b.spent_on.localeCompare(a.spent_on))),
  async saveExpense(_id, { receiptFile, ...input }) {
    if (input.amount !== undefined && !(input.amount > 0)) fail("Amount must be greater than zero");
    let receipt_path: string | undefined;
    if (receiptFile) {
      receipt_path = `${PID}/receipts/${uid()}-${receiptFile.name}`;
      objectUrls.set(receipt_path, URL.createObjectURL(receiptFile));
    }
    const existing = db.expenses.find((e) => e.id === input.id);
    if (existing) {
      Object.assign(existing, input, receipt_path ? { receipt_path } : {});
      log("expenses", `Updated expense "${existing.description}"`);
    } else {
      const e: Expense = { id: uid(), project_id: PID, stage_id: null, category: "Other", description: "", vendor: "", vendor_notes: "", amount: 0, spent_on: now().slice(0, 10), receipt_path: receipt_path ?? null, ...input };
      db.expenses.push(e);
      log("expenses", `Added expense "${e.description}"`);
    }
    refreshSpent();
  },
  async deleteExpense(expense) {
    db.expenses = db.expenses.filter((x) => x.id !== expense.id);
    refreshSpent();
    log("expenses", `Removed expense "${expense.description}"`);
  },
  receiptUrl: async (path) => urlFor(path),

  listMessages: () => wait(db.messages.map((m) => ({ ...m, attachment_url: m.attachment_path ? urlFor(m.attachment_path) : null }))),
  async sendMessage(_id, body, file) {
    let attachment_path: string | null = null;
    if (file) {
      attachment_path = `${PID}/chat/${uid()}-${file.name}`;
      objectUrls.set(attachment_path, URL.createObjectURL(file));
    }
    db.messages.push({ id: uid(), project_id: PID, sender_id: DEMO_USER.id, body, attachment_path, created_at: now() });
    notify("message", "New message from Jonas Weber", body || "Sent an attachment", "/chat");
    messageListeners.forEach((l) => l());
    // Simulated client reply so the demo chat feels alive.
    setTimeout(() => {
      db.messages.push({ id: uid(), project_id: PID, sender_id: SARAH, body: "Thanks Jonas — got it!", attachment_path: null, created_at: now() });
      messageListeners.forEach((l) => l());
    }, 1500);
  },
  subscribeMessages(_id, onChange) {
    messageListeners.add(onChange);
    return () => messageListeners.delete(onChange);
  },
  async markChatRead() {},
  joinPresence(_id, me, onChange) {
    const t = setTimeout(() => onChange([me.id, SARAH]), 300);
    return () => clearTimeout(t);
  },

  listNotifications: () => wait(db.notifications),
  async notifyClients(_id, title, body, link) {
    notify("manual", title, body, link);
  },
  listActivity: () => wait(db.activity),

  listKnowledge: () => wait(db.knowledge),
  async saveKnowledge(_id, input) {
    const existing = db.knowledge.find((k) => k.id === input.id);
    if (existing) {
      Object.assign(existing, input, { updated_at: now() });
      log("ai_knowledge", `Updated AI knowledge entry "${existing.title}"`);
    } else {
      const k: Knowledge = { id: uid(), project_id: PID, title: "", content: "", tags: [], is_visible: false, ...input, updated_at: now() };
      db.knowledge.push(k);
      log("ai_knowledge", `Added AI knowledge entry "${k.title}"`);
    }
  },
  async deleteKnowledge(kId) {
    const k = db.knowledge.find((x) => x.id === kId);
    db.knowledge = db.knowledge.filter((x) => x.id !== kId);
    log("ai_knowledge", `Removed AI knowledge entry "${k?.title}"`);
  },
};

/** Restore the demo data (used by the "Reset demo" action). */
export function resetDemo() {
  db = seed();
}

import { describe, it, expect } from "vitest";
import { getAiAnswer, type ProjectData } from "@/features/knowledge/domain/assistant";
import type { Knowledge, Photo, ProjectSummary, Room, Stage, Task } from "@/lib/database.types";

// A generous ASCII-only regex for "this looks like an English sentence" — letters, digits, spaces
// and basic punctuation only, no diacritics. Used to assert the answer carries no baked-in English
// text (it may of course contain ASCII data such as room/stage names in the fixtures below).
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

const project = (patch: Partial<ProjectSummary> = {}): ProjectSummary => ({
  id: "p1",
  name: "Kowalski Renovation",
  address: "1 Main St, 00-001 Warszawa",
  address_line: "1 Main St",
  postal_code: "00-001",
  city: "Warszawa",
  country: "PL",
  currency: "PLN",
  status: "active",
  client_display_name: "Sarah Kowalski",
  start_date: "2026-01-01",
  target_date: "2026-06-01",
  budget: 100000,
  planned_target_date: "2026-06-01",
  planned_budget: 100000,
  spent: 40000,
  schedule_status: "on_schedule",
  schedule_note: "",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  overall_progress: 45,
  stages_done: 1,
  stages_total: 3,
  current_stage: "Tiling",
  manager_name: "Jonas Weber",
  plan_image_path: null,
  plan_image_opts: {},
  ...patch,
});

const task = (name: string, done = false): Task => ({
  id: `t-${name}`,
  project_id: "p1",
  stage_id: "s1",
  room_id: null,
  name,
  done,
  sort_order: 0,
  is_visible: true,
});

const stage = (patch: Partial<Stage> & { name: string }): Stage => ({
  id: `stage-${patch.name}`,
  project_id: "p1",
  key: patch.name.toLowerCase(),
  status: "progress",
  progress: 50,
  progress_mode: "manual",
  start_date: "2026-02-01",
  end_date: "2026-02-15",
  client_note: "",
  sort_order: 0,
  is_visible: true,
  tasks: [],
  ...patch,
});

const room = (patch: Partial<Room> & { name: string }): Room => ({
  id: `room-${patch.name}`,
  project_id: "p1",
  key: patch.name.toLowerCase(),
  status: "progress",
  progress: 50,
  x: 0,
  y: 0,
  w: 1,
  h: 1,
  client_note: "",
  sort_order: 0,
  is_visible: true,
  ...patch,
});

const photo = (patch: Partial<Photo> & { caption: string }): Photo => ({
  id: `photo-${patch.caption}`,
  project_id: "p1",
  stage_id: null,
  room_id: null,
  progress_entry_id: null,
  storage_path: "path.jpg",
  alt: patch.caption,
  taken_at: "2026-02-10T00:00:00Z",
  uploaded_by: "u1",
  status: "published",
  published_at: "2026-02-10T00:00:00Z",
  url: "https://example.com/photo.jpg",
  ...patch,
});

const fact = (patch: Partial<Knowledge> & { title: string; content: string }): Knowledge => ({
  id: `fact-${patch.title}`,
  project_id: "p1",
  tags: [],
  is_visible: true,
  updated_at: "2026-01-01T00:00:00Z",
  ...patch,
});

const baseData = (patch: Partial<ProjectData> = {}): ProjectData => ({
  project: project(),
  stages: [stage({ name: "Demolition", status: "done", progress: 100 }), stage({ name: "Tiling", status: "progress", progress: 40 })],
  rooms: [room({ name: "Kitchen", status: "progress" })],
  photos: [],
  knowledge: [],
  ...patch,
});

describe("getAiAnswer", () => {
  it("answers 'blocked' with the blocked rooms, in English and Polish", () => {
    const data = baseData({ rooms: [room({ name: "Kitchen", status: "blocked", progress: 30, client_note: "Waiting on tiles" })] });
    for (const q of ["Is anything blocked?", "Czy coś jest zablokowane?"]) {
      const answer = getAiAnswer(q, data);
      expect(answer.kind).toBe("blocked");
      if (answer.kind !== "blocked") throw new Error("unreachable");
      expect(answer.params).toEqual({ roomNames: ["Kitchen"], progress: 30, note: "Waiting on tiles" });
      expect(answer.sources).toEqual([{ kind: "room", params: { name: "Kitchen" } }]);
      expect(answer.links).toEqual([{ section: "plan" }, { section: "photos" }]);
    }
  });

  it("answers 'nothing_blocked' when no room is blocked", () => {
    const data = baseData();
    for (const q of ["Is anything blocked?", "Czy coś jest zablokowane?"]) {
      const answer = getAiAnswer(q, data);
      expect(answer.kind).toBe("nothing_blocked");
      expect(answer.sources).toEqual([{ kind: "section", params: { section: "plan" } }]);
      expect(answer.links).toEqual([{ section: "plan" }]);
    }
  });

  it("answers 'budget' with spent/budget/pct/remaining, in English and Polish", () => {
    const data = baseData({ project: project({ budget: 100000, spent: 40000, overall_progress: 45 }) });
    for (const q of ["How much of the budget is spent?", "Ile budżetu wydano?"]) {
      const answer = getAiAnswer(q, data);
      expect(answer.kind).toBe("budget");
      if (answer.kind !== "budget") throw new Error("unreachable");
      expect(answer.params).toEqual({ spent: 40000, budget: 100000, pct: 40, remaining: 60000, overallProgress: 45, currency: "PLN" });
      expect(answer.sources).toEqual([
        { kind: "project", params: { field: "budget" } },
        { kind: "project", params: { field: "progress" } },
      ]);
      expect(answer.links).toEqual([{ section: "" }]);
    }
  });

  it("answers 'stage' when the question names a stage", () => {
    const data = baseData({
      stages: [stage({ name: "Tiling", status: "progress", progress: 40, tasks: [task("Grout", false)] })],
    });
    const answer = getAiAnswer("When does Tiling start?", data);
    expect(answer.kind).toBe("stage");
    if (answer.kind !== "stage") throw new Error("unreachable");
    expect(answer.params.name).toBe("Tiling");
    expect(answer.params.nextTask).toBe("Grout");
    expect(answer.sources).toEqual([{ kind: "stage", params: { index: 1, name: "Tiling" } }]);
    expect(answer.links).toEqual([{ section: "stages" }, { section: "design" }]);
  });

  it("answers 'next' with the in-progress stages and the next pending one, in English and Polish", () => {
    const data = baseData({
      stages: [
        stage({ name: "Demolition", status: "done", progress: 100 }),
        stage({ name: "Tiling", status: "progress", progress: 40, tasks: [task("Grout", false)] }),
        stage({ name: "Painting", status: "pending", progress: 0 }),
      ],
    });
    for (const q of ["What's next on my project?", "Co dalej w moim projekcie?"]) {
      const answer = getAiAnswer(q, data);
      expect(answer.kind).toBe("next");
      if (answer.kind !== "next") throw new Error("unreachable");
      expect(answer.params.current).toEqual([{ name: "Tiling", progress: 40, endDate: "2026-02-15" }]);
      expect(answer.params.openTasks).toEqual(["Grout"]);
      expect(answer.params.nextStage).toEqual({ name: "Painting", startDate: "2026-02-01" });
      expect(answer.links).toEqual([{ section: "stages" }]);
    }
  });

  it("answers 'next' as empty when nothing is active or upcoming", () => {
    const data = baseData({ stages: [stage({ name: "Demolition", status: "done", progress: 100 })] });
    const answer = getAiAnswer("What's next?", data);
    expect(answer.kind).toBe("next");
    if (answer.kind !== "next") throw new Error("unreachable");
    expect(answer.params.current).toEqual([]);
    expect(answer.params.nextStage).toBeNull();
    expect(answer.sources).toEqual([{ kind: "section", params: { section: "stages" } }]);
  });

  it("answers 'finish' with the target date and completion count, in English and Polish", () => {
    const data = baseData({
      project: project({ target_date: "2026-06-01" }),
      stages: [
        stage({ name: "Demolition", status: "done", progress: 100 }),
        stage({ name: "Painting", status: "pending", progress: 0, start_date: "2026-05-01", end_date: "2026-06-01" }),
      ],
    });
    for (const q of ["When will everything be finished?", "Kiedy wszystko będzie skończone?"]) {
      const answer = getAiAnswer(q, data);
      expect(answer.kind).toBe("finish");
      if (answer.kind !== "finish") throw new Error("unreachable");
      expect(answer.params.targetDate).toBe("2026-06-01");
      expect(answer.params.lastStage).toEqual({ name: "Painting", startDate: "2026-05-01", endDate: "2026-06-01" });
      expect(answer.params.doneCount).toBe(1);
      expect(answer.params.totalCount).toBe(2);
    }
  });

  it("answers 'photos' with the latest photos, in English and Polish", () => {
    const data = baseData({ photos: [photo({ caption: "New tiles" }), photo({ caption: "Grout done" })] });
    for (const q of ["Show me the latest updates", "Pokaż mi najnowsze zdjęcia"]) {
      const answer = getAiAnswer(q, data);
      expect(answer.kind).toBe("photos");
      if (answer.kind !== "photos") throw new Error("unreachable");
      expect(answer.params.photos.map((p) => p.caption)).toEqual(["New tiles", "Grout done"]);
      expect(answer.links).toEqual([{ section: "photos" }]);
    }
  });

  it("answers 'room' when the question names a room", () => {
    const data = baseData({ rooms: [room({ name: "Bathroom", status: "done", progress: 100, client_note: "Sealed and ready" })] });
    const answer = getAiAnswer("How is the Bathroom looking?", data);
    expect(answer.kind).toBe("room");
    if (answer.kind !== "room") throw new Error("unreachable");
    expect(answer.params).toEqual({ name: "Bathroom", status: "done", progress: 100, note: "Sealed and ready" });
    expect(answer.sources).toEqual([{ kind: "room", params: { name: "Bathroom" } }]);
  });

  it("answers 'fact' from a manager-written knowledge entry, matched by keyword", () => {
    const data = baseData({
      knowledge: [fact({ title: "Working hours", content: "The crew works 8am to 4pm on weekdays.", tags: ["hours", "schedule"] })],
    });
    const answer = getAiAnswer("What are your working hours?", data);
    expect(answer.kind).toBe("fact");
    if (answer.kind !== "fact") throw new Error("unreachable");
    expect(answer.params).toEqual({ title: "Working hours", content: "The crew works 8am to 4pm on weekdays." });
    expect(answer.sources).toEqual([{ kind: "fact", params: { title: "Working hours" } }]);
    expect(answer.links).toEqual([]);
  });

  it("answers 'fallback' when nothing else matches, in English and Polish", () => {
    const data = baseData({ project: project({ overall_progress: 45, manager_name: "Jonas Weber" }) });
    for (const q of ["What's your favorite color?", "Jaki jest twój ulubiony kolor?"]) {
      const answer = getAiAnswer(q, data);
      expect(answer.kind).toBe("fallback");
      if (answer.kind !== "fallback") throw new Error("unreachable");
      expect(answer.params).toEqual({ overallProgress: 45, managerName: "Jonas Weber" });
      expect(answer.sources).toEqual([{ kind: "section", params: { section: "overview" } }]);
      expect(answer.links).toEqual([{ section: "" }]);
    }
  });

  it("carries no baked-in English sentence text — every string is either an enum/id or raw project data", () => {
    const data = baseData({ rooms: [room({ name: "Kitchen", status: "blocked", progress: 30 })] });
    const answer = getAiAnswer("Is anything blocked?", data);
    const strings = collectStrings(answer);
    // Every string in the answer must be traceable to a fixture value, the `kind`, or a section/field enum.
    const allowed = new Set(["blocked", "room", "plan", "photos", "Kitchen"]);
    for (const s of strings) expect(allowed.has(s), `unexpected string in answer: "${s}"`).toBe(true);
  });
});

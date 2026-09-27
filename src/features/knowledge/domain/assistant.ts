import type { Knowledge, Photo, ProjectSummary, Room, Stage } from "@/lib/database.types";
import type { Status } from "@/domain/status";

export type ProjectData = {
  project: ProjectSummary;
  stages: Stage[];
  rooms: Room[];
  photos: Photo[];
  /** Facts the site manager marked visible for the assistant. */
  knowledge: Knowledge[];
};

/** Where an answer can point: a project section ("" is the overview). */
export type AiLinkSection = "" | "stages" | "plan" | "photos" | "design";
export type AiLink = { section: AiLinkSection };

/**
 * One piece of project data an answer is grounded in. No language lives here — the UI turns
 * `kind` + `params` into text with i18n (`ai-answer.tsx`).
 */
export type AiSource =
  | { kind: "room"; params: { name: string } }
  | { kind: "stage"; params: { index: number; name: string } }
  | { kind: "project"; params: { field: "budget" | "progress" | "dates" } }
  | { kind: "photo"; params: { caption: string; date: string } }
  | { kind: "fact"; params: { title: string } }
  | { kind: "section"; params: { section: "plan" | "stages" | "overview" } };

/**
 * The assistant's answer, as data: a `kind`, the raw values it needs (numbers and dates stay raw,
 * never formatted here) and what it's grounded in. `ai-answer.tsx` is the only place that turns
 * this into language, via i18n keys named after `kind`.
 */
export type AiAnswer =
  | { kind: "blocked"; params: { roomNames: string[]; progress: number; note: string | null }; sources: AiSource[]; links: AiLink[] }
  | { kind: "nothing_blocked"; params: Record<string, never>; sources: AiSource[]; links: AiLink[] }
  | {
      kind: "budget";
      params: { spent: number; budget: number; pct: number; remaining: number; overallProgress: number };
      sources: AiSource[];
      links: AiLink[];
    }
  | {
      kind: "stage";
      params: {
        name: string;
        startDate: string | null;
        endDate: string | null;
        status: Status;
        progress: number;
        nextTask: string | null;
        note: string | null;
      };
      sources: AiSource[];
      links: AiLink[];
    }
  | {
      kind: "next";
      params: {
        current: { name: string; progress: number; endDate: string | null }[];
        openTasks: string[];
        nextStage: { name: string; startDate: string | null } | null;
      };
      sources: AiSource[];
      links: AiLink[];
    }
  | {
      kind: "finish";
      params: {
        targetDate: string | null;
        lastStage: { name: string; startDate: string | null; endDate: string | null } | null;
        doneCount: number;
        totalCount: number;
      };
      sources: AiSource[];
      links: AiLink[];
    }
  | { kind: "photos"; params: { photos: { caption: string; date: string }[] }; sources: AiSource[]; links: AiLink[] }
  | {
      kind: "room";
      params: { name: string; status: Status; progress: number; note: string | null };
      sources: AiSource[];
      links: AiLink[];
    }
  | { kind: "fact"; params: { title: string; content: string }; sources: AiSource[]; links: AiLink[] }
  | { kind: "fallback"; params: { overallProgress: number; managerName: string | null }; sources: AiSource[]; links: AiLink[] };

export type AiAnswerKind = AiAnswer["kind"];

// -- Question matching -------------------------------------------------------------------------
// English and Polish keywords, diacritics-insensitive, so the same rules answer both languages.

const LETTER_FOLD: Record<string, string> = { ł: "l", Ł: "l" };

/** Lowercase, ASCII-folded (Polish diacritics stripped) so keyword matching works in either language. */
function normalize(s: string): string {
  return s
    .split("")
    .map((c) => LETTER_FOLD[c] ?? c)
    .join("")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const words = (s: string) =>
  normalize(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);

const KEYWORDS = {
  blocked: ["block", "zablokowan", "wstrzyman"],
  budget: ["budget", "spent", "cost", "money", "budzet", "koszt", "wydan", "pieniadz"],
  next: ["next", "upcoming", "co dalej", "nastepn", "dzieje sie"],
  finish: ["finish", "complete", "koniec", "zakonczeni", "zakonczony", "gotowe"],
  when: ["when", "kiedy"],
  photo: ["photo", "latest", "update", "zdjeci", "najnowsz", "aktualnosc"],
} as const;

// Short, generic words ("now", "end", "done") are only matched whole-word, so they don't collide
// with substrings inside unrelated words ("najnowsze" contains "now"; "attend" contains "end").
const WORD_KEYWORDS = { now: ["now"], end: ["end"], done: ["done"] } as const;

const includesAny = (q: string, list: readonly string[]) => list.some((k) => q.includes(k));
const includesWord = (q: string, list: readonly string[]) => list.some((k) => new RegExp(`\\b${k}\\b`).test(q));

const stageSource = (stages: Stage[], s: Stage): AiSource => ({ kind: "stage", params: { index: stages.indexOf(s) + 1, name: s.name } });

/**
 * Single entry point for the assistant. Currently a rule-based answerer over the project data,
 * returning a structured, language-free answer; replace the body with a server call to an AI
 * model (passing `data` as context) without touching the UI or this signature.
 */
export function getAiAnswer(question: string, data: ProjectData): AiAnswer {
  const q = normalize(question);
  const { stages: st, rooms: rm, project: p, photos, knowledge } = data;
  const current = st.filter((s) => s.status === "progress");
  const pending = st.filter((s) => s.status === "pending");
  const room = rm.find((r) => q.includes(normalize(r.name)));

  if (includesAny(q, KEYWORDS.blocked)) {
    const blocked = rm.filter((r) => r.status === "blocked");
    if (!blocked.length) {
      return {
        kind: "nothing_blocked",
        params: {},
        sources: [{ kind: "section", params: { section: "plan" } }],
        links: [{ section: "plan" }],
      };
    }
    return {
      kind: "blocked",
      params: { roomNames: blocked.map((r) => r.name), progress: blocked[0].progress, note: blocked[0].client_note || null },
      sources: blocked.map((r): AiSource => ({ kind: "room", params: { name: r.name } })),
      links: [{ section: "plan" }, { section: "photos" }],
    };
  }

  if (includesAny(q, KEYWORDS.budget)) {
    const pct = p.budget ? Math.round((p.spent / p.budget) * 100) : 0;
    return {
      kind: "budget",
      params: { spent: p.spent, budget: p.budget, pct, remaining: p.budget - p.spent, overallProgress: p.overall_progress },
      sources: [
        { kind: "project", params: { field: "budget" } },
        { kind: "project", params: { field: "progress" } },
      ],
      links: [{ section: "" }],
    };
  }

  const stageMatch = st.find((s) => q.includes(normalize(s.name)) || words(s.name).some((w) => q.includes(w)));
  if (stageMatch) {
    const open = stageMatch.tasks.find((t) => !t.done);
    return {
      kind: "stage",
      params: {
        name: stageMatch.name,
        startDate: stageMatch.start_date,
        endDate: stageMatch.end_date,
        status: stageMatch.status,
        progress: stageMatch.progress,
        nextTask: open ? open.name : null,
        note: stageMatch.client_note || null,
      },
      sources: [stageSource(st, stageMatch)],
      links: [{ section: "stages" }, { section: "design" }],
    };
  }

  if (includesAny(q, KEYWORDS.next) || includesWord(q, WORD_KEYWORDS.now)) {
    const nextStage = pending[0] ?? null;
    const openTasks = current.flatMap((s) => s.tasks.filter((t) => !t.done).map((t) => t.name));
    const hasAny = current.length > 0 || nextStage !== null;
    return {
      kind: "next",
      params: {
        current: current.map((s) => ({ name: s.name, progress: s.progress, endDate: s.end_date })),
        openTasks,
        nextStage: nextStage ? { name: nextStage.name, startDate: nextStage.start_date } : null,
      },
      sources: hasAny
        ? [...current.map((s) => stageSource(st, s)), ...(nextStage ? [stageSource(st, nextStage)] : [])]
        : [{ kind: "section", params: { section: "stages" } }],
      links: [{ section: "stages" }],
    };
  }

  if (
    includesAny(q, KEYWORDS.finish) ||
    includesAny(q, KEYWORDS.when) ||
    includesWord(q, WORD_KEYWORDS.end) ||
    includesWord(q, WORD_KEYWORDS.done)
  ) {
    const last = st[st.length - 1] ?? null;
    return {
      kind: "finish",
      params: {
        targetDate: p.target_date,
        lastStage: last ? { name: last.name, startDate: last.start_date, endDate: last.end_date } : null,
        doneCount: st.filter((s) => s.status === "done").length,
        totalCount: st.length,
      },
      sources: [{ kind: "project", params: { field: "dates" } }, ...(last ? [stageSource(st, last)] : [])],
      links: [{ section: "stages" }],
    };
  }

  if (includesAny(q, KEYWORDS.photo)) {
    const latest = photos.slice(0, 3);
    return {
      kind: "photos",
      params: { photos: latest.map((ph) => ({ caption: ph.caption, date: ph.taken_at })) },
      sources: latest.map((ph): AiSource => ({ kind: "photo", params: { caption: ph.caption, date: ph.taken_at } })),
      links: [{ section: "photos" }],
    };
  }

  if (room) {
    return {
      kind: "room",
      params: { name: room.name, status: room.status, progress: room.progress, note: room.client_note || null },
      sources: [{ kind: "room", params: { name: room.name } }],
      links: [{ section: "plan" }],
    };
  }

  // Facts the manager wrote for the assistant.
  const qWords = words(question);
  const fact = knowledge
    .map((k) => ({ k, score: qWords.filter((w) => normalize(`${k.title} ${k.tags.join(" ")} ${k.content}`).includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.k;
  if (fact) {
    return {
      kind: "fact",
      params: { title: fact.title, content: fact.content },
      sources: [{ kind: "fact", params: { title: fact.title } }],
      links: [],
    };
  }

  return {
    kind: "fallback",
    params: { overallProgress: p.overall_progress, managerName: p.manager_name },
    sources: [{ kind: "section", params: { section: "overview" } }],
    links: [{ section: "" }],
  };
}

/** Keys under `knowledge:assistant.suggestions.*`, shown as tappable chips above the composer. */
export const suggestedQuestionKeys = ["next", "blocked", "budget", "finish", "photos"] as const;

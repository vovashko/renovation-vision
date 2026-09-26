import { statusLabel } from "@/lib/status";
import { longDate, money, shortDate } from "@/lib/format";
import type { Knowledge, Photo, ProjectSummary, Room, Stage } from "@/lib/database.types";

export type ProjectData = {
  project: ProjectSummary;
  stages: Stage[];
  rooms: Room[];
  photos: Photo[];
  /** Facts the site manager marked visible for the assistant. */
  knowledge: Knowledge[];
};

/** Where an answer can point: a project section ("" is the overview). */
export type AiLink = { label: string; section: "" | "stages" | "plan" | "photos" | "design" };
export type AiAnswer = { text: string; sources: string[]; links: AiLink[] };

const stageRef = (stages: Stage[], s: Stage) => `Stage ${stages.indexOf(s) + 1}: ${s.name}`;

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);

/**
 * Single entry point for the assistant. Currently a rule-based answerer over the
 * project data; replace the body with a server call to an AI model (passing
 * `data` as context) without touching the UI.
 */
export async function getAiAnswer(question: string, data: ProjectData): Promise<AiAnswer> {
  const q = question.toLowerCase();
  const { stages: st, rooms: rm, project: p, photos, knowledge } = data;
  const current = st.filter((s) => s.status === "progress");
  const pending = st.filter((s) => s.status === "pending");
  const room = rm.find((r) => q.includes(r.name.toLowerCase()));

  if (q.includes("block")) {
    const blocked = rm.filter((r) => r.status === "blocked");
    if (!blocked.length) return { text: "Nothing is blocked right now.", sources: ["Plan: room statuses"], links: [{ label: "Open plan", section: "plan" }] };
    const notes = blocked.map((r) => r.client_note && `${r.name}: ${r.client_note}`).filter(Boolean).join(" ");
    return {
      text: `${blocked.map((r) => r.name).join(", ")} ${blocked.length > 1 ? "are" : "is"} blocked at ${blocked[0].progress}%. ${notes || "Your site manager hasn't added a reason yet — ask them in chat."}`,
      sources: blocked.map((r) => `Plan: ${r.name} status`),
      links: [{ label: "Open plan", section: "plan" }, { label: "See photos", section: "photos" }],
    };
  }

  if (q.includes("budget") || q.includes("spent") || q.includes("cost") || q.includes("money")) {
    const pct = p.budget ? Math.round((p.spent / p.budget) * 100) : 0;
    return {
      text: `${money(p.spent)} of the ${money(p.budget)} budget is spent (${pct}%), leaving ${money(p.budget - p.spent)}. The project is ${p.overall_progress}% complete overall.`,
      sources: ["Project budget", "Overall progress"],
      links: [{ label: "Overview", section: "" }],
    };
  }

  const stageMatch = st.find((s) => q.includes(s.name.toLowerCase()) || words(s.name).some((w) => q.includes(w)));
  if (stageMatch && (q.includes("start") || q.includes("when") || q.includes("kitchen") || words(stageMatch.name).some((w) => q.includes(w)))) {
    const open = stageMatch.tasks.find((t) => !t.done);
    return {
      text: `${stageMatch.name} runs ${shortDate(stageMatch.start_date)} – ${shortDate(stageMatch.end_date)}. It's currently ${statusLabel[stageMatch.status].toLowerCase()} (${stageMatch.progress}%).${open ? ` Next task: ${open.name.toLowerCase()}.` : ""}${stageMatch.client_note ? ` ${stageMatch.client_note}` : ""}`,
      sources: [stageRef(st, stageMatch)],
      links: [{ label: "View stages", section: "stages" }, { label: "Planned look", section: "design" }],
    };
  }

  if (q.includes("next") || q.includes("upcoming") || q.includes("what's happening") || q.includes("now")) {
    const nextStage = pending[0];
    if (!current.length && !nextStage) return { text: "There are no active or upcoming stages right now.", sources: ["Stages"], links: [{ label: "View stages", section: "stages" }] };
    const cur = current.map((s) => `${s.name} (${s.progress}%, until ${shortDate(s.end_date)})`).join(" and ");
    const openTasks = current.flatMap((s) => s.tasks.filter((t) => !t.done).map((t) => t.name.toLowerCase()));
    return {
      text: `${cur ? `Right now the team is working on ${cur}.` : "No stage is in progress right now."}${openTasks.length ? ` Remaining tasks: ${openTasks.join(", ")}.` : ""} ${nextStage ? `Next up is ${nextStage.name}, starting ${shortDate(nextStage.start_date)}.` : ""}`.trim(),
      sources: [...current.map((s) => stageRef(st, s)), ...(nextStage ? [stageRef(st, nextStage)] : [])],
      links: [{ label: "View stages", section: "stages" }],
    };
  }

  if (q.includes("finish") || q.includes("done") || q.includes("complete") || q.includes("when") || q.includes("end")) {
    const last = st[st.length - 1];
    return {
      text: `The target completion date is ${longDate(p.target_date)}${last ? `, ending with ${last.name} (${shortDate(last.start_date)} – ${shortDate(last.end_date)})` : ""}. ${st.filter((s) => s.status === "done").length} of ${st.length} stages are complete.`,
      sources: ["Project dates", ...(last ? [stageRef(st, last)] : [])],
      links: [{ label: "View stages", section: "stages" }],
    };
  }

  if (q.includes("photo") || q.includes("latest") || q.includes("update")) {
    const latest = photos.slice(0, 3);
    return {
      text: latest.length ? `Latest updates: ${latest.map((ph) => `"${ph.caption}"`).join(" · ")}` : "No photos have been shared yet.",
      sources: latest.map((ph) => `Site photo, ${new Date(ph.taken_at).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}`),
      links: [{ label: "See photos", section: "photos" }],
    };
  }

  if (room) {
    return {
      text: `${room.name} is ${statusLabel[room.status].toLowerCase()} at ${room.progress}%.${room.client_note ? ` ${room.client_note}` : ""}`,
      sources: [`Plan: ${room.name} status`],
      links: [{ label: "Open plan", section: "plan" }],
    };
  }

  // Facts the manager wrote for the assistant.
  const qWords = words(q);
  const fact = knowledge
    .map((k) => ({ k, score: qWords.filter((w) => `${k.title} ${k.tags.join(" ")} ${k.content}`.toLowerCase().includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.k;
  if (fact) return { text: fact.content, sources: [`Site manager note: ${fact.title}`], links: [] };

  return {
    text: `I can only answer from the project data. The project is ${p.overall_progress}% complete; I can tell you about stages, dates, the budget, room statuses, blocked items and recent photos. For anything else, ask ${p.manager_name ?? "your site manager"}.`,
    sources: ["Project overview"],
    links: [{ label: "Overview", section: "" }],
  };
}

export const suggestedQuestions = [
  "What's next on my project?",
  "Is anything blocked?",
  "How much of the budget is spent?",
  "When will everything be finished?",
  "Show me the latest updates",
];

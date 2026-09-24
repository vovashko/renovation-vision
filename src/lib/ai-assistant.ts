import { overallProgress, project, rooms, stages, statusLabel, type Room, type Stage } from "@/lib/renovation-data";
import type { SitePhoto } from "@/lib/media-data";

export type ProjectData = {
  project: typeof project;
  stages: Stage[];
  rooms: Room[];
  photos: SitePhoto[];
};

export type AiLink = { label: string; to: "/stages" | "/plan" | "/photos" | "/design" | "/" };
export type AiAnswer = { text: string; sources: string[]; links: AiLink[] };

export const defaultProjectData = (photos: SitePhoto[]): ProjectData => ({ project, stages, rooms, photos });

const stageRef = (s: Stage) => `Stage ${stages.indexOf(s) + 1}: ${s.name}`;

/**
 * Single entry point for the assistant. Currently a rule-based answerer over the
 * project data; replace the body with a server call to an AI model (passing
 * `data` as context) without touching the UI.
 */
export async function getAiAnswer(question: string, data: ProjectData): Promise<AiAnswer> {
  const q = question.toLowerCase();
  const { stages: st, rooms: rm, project: p, photos } = data;
  const current = st.filter((s) => s.status === "progress");
  const pending = st.filter((s) => s.status === "pending");

  const room = rm.find((r) => q.includes(r.name.toLowerCase()) || (r.id === "bed2" && q.includes("bedroom 2")));

  if (q.includes("block")) {
    const blocked = rm.filter((r) => r.status === "blocked");
    const photo = photos.find((ph) => ph.roomId === "bed2");
    return {
      text: blocked.length
        ? `${blocked.map((r) => r.name).join(", ")} ${blocked.length > 1 ? "are" : "is"} blocked at ${blocked[0].progress}%. The team is waiting for the electrical inspector to sign off the new circuit before the walls can be closed.${photo ? ` Latest note from ${photo.uploadedBy}: "${photo.caption}"` : ""}`
        : "Nothing is blocked right now.",
      sources: ["Plan: Bedroom 2 status", "Site photo update (Apr 17)", "Manager chat, 09:21"],
      links: [{ label: "Open plan", to: "/plan" }, { label: "See photos", to: "/photos" }],
    };
  }

  if (q.includes("budget") || q.includes("spent") || q.includes("cost") || q.includes("money")) {
    const pct = Math.round((p.spent / p.budget) * 100);
    return {
      text: `$${p.spent.toLocaleString()} of the $${p.budget.toLocaleString()} budget is spent (${pct}%), leaving $${(p.budget - p.spent).toLocaleString()}. The project is ${overallProgress()}% complete overall.`,
      sources: ["Project budget", "Overall progress"],
      links: [{ label: "Overview", to: "/" }],
    };
  }

  if (q.includes("kitchen")) {
    const k = st.find((s) => s.id === "kitch")!;
    const r = rm.find((x) => x.id === "kitchen")!;
    return {
      text: `The Kitchen Install is scheduled to start on ${k.start} and finish by ${k.end}. It's currently ${statusLabel[k.status].toLowerCase()} — first up is ${k.tasks[0].name.toLowerCase()}. The kitchen room itself is at ${r.progress}%.`,
      sources: [stageRef(k), "Plan: Kitchen status"],
      links: [{ label: "View stages", to: "/stages" }, { label: "Planned look", to: "/design" }],
    };
  }

  if (q.includes("next") || q.includes("upcoming") || q.includes("what's happening") || q.includes("now")) {
    const cur = current.map((s) => `${s.name} (${s.progress}%, until ${s.end})`).join(" and ");
    const nextStage = pending[0];
    const openTasks = current.flatMap((s) => s.tasks.filter((t) => !t.done).map((t) => t.name.toLowerCase()));
    return {
      text: `Right now the team is working on ${cur}. Remaining tasks: ${openTasks.join(", ")}. ${nextStage ? `Next up is ${nextStage.name}, starting ${nextStage.start}.` : ""}`,
      sources: [...current.map(stageRef), ...(nextStage ? [stageRef(nextStage)] : [])],
      links: [{ label: "View stages", to: "/stages" }],
    };
  }

  if (q.includes("finish") || q.includes("done") || q.includes("complete") || q.includes("when") || q.includes("end")) {
    return {
      text: `The target completion date is ${p.targetDate}, ending with the ${st[st.length - 1].name} (${st[st.length - 1].start} – ${st[st.length - 1].end}). ${st.filter((s) => s.status === "done").length} of ${st.length} stages are complete.`,
      sources: ["Project dates", stageRef(st[st.length - 1])],
      links: [{ label: "View stages", to: "/stages" }],
    };
  }

  if (q.includes("photo") || q.includes("latest") || q.includes("update")) {
    const latest = photos.slice(0, 3);
    return {
      text: `Latest updates: ${latest.map((ph) => `"${ph.caption}"`).join(" · ")}`,
      sources: latest.map((ph) => `Site photo, ${new Date(ph.takenAt).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}`),
      links: [{ label: "See photos", to: "/photos" }],
    };
  }

  if (room) {
    return {
      text: `${room.name} is ${statusLabel[room.status].toLowerCase()} at ${room.progress}%.`,
      sources: [`Plan: ${room.name} status`],
      links: [{ label: "Open plan", to: "/plan" }],
    };
  }

  return {
    text: `I can only answer from the project data. The project is ${overallProgress()}% complete; I can tell you about stages, dates, the budget, room statuses, blocked items and recent photos. For anything else, ask ${p.manager}.`,
    sources: ["Project overview"],
    links: [{ label: "Overview", to: "/" }],
  };
}

export const suggestedQuestions = [
  "What's next on my project?",
  "Why is Bedroom 2 blocked?",
  "How much of the budget is spent?",
  "When will the kitchen start?",
  "When will everything be finished?",
  "Show me the latest updates",
];

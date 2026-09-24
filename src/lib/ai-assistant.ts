import {
  overallProgress,
  project,
  rooms,
  stages,
  statusLabel,
  type Room,
  type Stage,
} from "@/lib/renovation-data";
import { renders, type Render, type SitePhoto } from "@/lib/media-data";

export type ProjectData = {
  project: typeof project;
  stages: Stage[];
  rooms: Room[];
  photos: SitePhoto[];
  renders: Render[];
};

export type AiLink = { label: string; to: "/stages" | "/plan" | "/photos" | "/design" | "/" };
export type AiAnswer = { text: string; sources: string[]; links: AiLink[] };

export const defaultProjectData = (photos: SitePhoto[]): ProjectData => ({
  project,
  stages,
  rooms,
  photos,
  renders,
});

const stageRef = (s: Stage) => `Stage ${stages.indexOf(s) + 1}: ${s.name}`;

/**
 * Single entry point for the assistant. Currently a rule-based answerer over the
 * project data; replace the body with a server call to an AI model (passing
 * `data` as context) without touching the UI.
 */
export async function getAiAnswer(question: string, data: ProjectData): Promise<AiAnswer> {
  const q = question.toLowerCase();
  // Match terms at a word start ("blocked" matches "block", "know" doesn't match "now").
  const has = (...terms: string[]) =>
    terms.some((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(q));
  const { stages: st, rooms: rm, project: p, photos, renders: rd } = data;
  const current = st.filter((s) => s.status === "progress");
  const pending = st.filter((s) => s.status === "pending");

  const room = rm.find(
    (r) => q.includes(r.name.toLowerCase()) || (r.id === "bed2" && has("bedroom 2")),
  );

  if (has("block")) {
    const blocked = rm.filter((r) => r.status === "blocked");
    const photo = photos.find((ph) => ph.roomId === "bed2");
    return {
      text: blocked.length
        ? `${blocked.map((r) => r.name).join(", ")} ${blocked.length > 1 ? "are" : "is"} blocked at ${blocked[0].progress}%. The team is waiting for the electrical inspector to sign off the new circuit before the walls can be closed.${photo ? ` Latest note from ${photo.uploadedBy}: "${photo.caption}"` : ""}`
        : "Nothing is blocked right now.",
      sources: ["Plan: Bedroom 2 status", "Site photo update (Apr 17)", "Manager chat, 09:21"],
      links: [
        { label: "Open plan", to: "/plan" },
        { label: "See photos", to: "/photos" },
      ],
    };
  }

  if (has("budget", "spent", "cost", "money")) {
    const pct = Math.round((p.spent / p.budget) * 100);
    return {
      text: `$${p.spent.toLocaleString()} of the $${p.budget.toLocaleString()} budget is spent (${pct}%), leaving $${(p.budget - p.spent).toLocaleString()}. The project is ${overallProgress()}% complete overall.`,
      sources: ["Project budget", "Overall progress"],
      links: [{ label: "Overview", to: "/" }],
    };
  }

  if (has("kitchen")) {
    const k = st.find((s) => s.id === "kitch")!;
    const r = rm.find((x) => x.id === "kitchen")!;
    return {
      text: `The Kitchen Install is scheduled to start on ${k.start} and finish by ${k.end}. It's currently ${statusLabel[k.status].toLowerCase()} — first up is ${k.tasks[0].name.toLowerCase()}. The kitchen room itself is at ${r.progress}%.`,
      sources: [stageRef(k), "Plan: Kitchen status"],
      links: [
        { label: "View stages", to: "/stages" },
        { label: "Planned look", to: "/design" },
      ],
    };
  }

  if (room) {
    const latest = photos.find((ph) => ph.roomId === room.id);
    const hasRender = rd.some((r) => r.roomId === room.id);
    return {
      text: `${room.name} is ${statusLabel[room.status].toLowerCase()} at ${room.progress}%.${latest ? ` Latest photo from ${latest.uploadedBy}: "${latest.caption}"` : " There are no site photos of this room yet."}`,
      sources: [
        `Plan: ${room.name} status`,
        ...(latest
          ? [
              `Site photo, ${new Date(latest.takenAt).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}`,
            ]
          : []),
      ],
      links: [
        { label: "Open plan", to: "/plan" },
        ...(latest ? [{ label: "See photos", to: "/photos" } as AiLink] : []),
        ...(hasRender ? [{ label: "Planned look", to: "/design" } as AiLink] : []),
      ],
    };
  }

  if (has("next", "upcoming", "what's happening", "now")) {
    const cur = current.map((s) => `${s.name} (${s.progress}%, until ${s.end})`).join(" and ");
    const nextStage = pending[0];
    const openTasks = current.flatMap((s) =>
      s.tasks.filter((t) => !t.done).map((t) => t.name.toLowerCase()),
    );
    return {
      text: `Right now the team is working on ${cur}. Remaining tasks: ${openTasks.join(", ")}. ${nextStage ? `Next up is ${nextStage.name}, starting ${nextStage.start}.` : ""}`,
      sources: [...current.map(stageRef), ...(nextStage ? [stageRef(nextStage)] : [])],
      links: [{ label: "View stages", to: "/stages" }],
    };
  }

  if (has("finish", "done", "complete", "when", "end")) {
    return {
      text: `The target completion date is ${p.targetDate}, ending with the ${st[st.length - 1].name} (${st[st.length - 1].start} – ${st[st.length - 1].end}). ${st.filter((s) => s.status === "done").length} of ${st.length} stages are complete.`,
      sources: ["Project dates", stageRef(st[st.length - 1])],
      links: [{ label: "View stages", to: "/stages" }],
    };
  }

  if (has("photo", "latest", "update")) {
    const latest = photos.slice(0, 3);
    return {
      text: `Latest updates: ${latest.map((ph) => `"${ph.caption}"`).join(" · ")}`,
      sources: latest.map(
        (ph) =>
          `Site photo, ${new Date(ph.takenAt).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}`,
      ),
      links: [{ label: "See photos", to: "/photos" }],
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

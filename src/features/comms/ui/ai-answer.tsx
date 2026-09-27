import { Link } from "@tanstack/react-router";
import { Icon } from "@/components/ui/icon";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AiAnswer } from "@/lib/ai-assistant";

/** One assistant reply: the streamed answer text, its sources, and link/hand-off chips. */
export function AiAnswerMessage({
  text,
  answer,
  question,
  projectId,
  managerName,
  onAskManager,
}: {
  text: string;
  answer?: AiAnswer;
  question?: string;
  projectId: string;
  managerName: string;
  onAskManager: (question: string) => void;
}) {
  return (
    <div className="max-w-[92%] text-body-md">
      <div className="leading-relaxed whitespace-pre-wrap">{text}</div>
      {answer && (
        <div className="mt-2 space-y-2">
          <div className="text-body-sm text-on-surface-variant">Based on: {answer.sources.join(" · ")}</div>
          <div className="flex flex-wrap gap-2">
            {answer.links.map((l) => (
              <Link
                key={l.label}
                to={(l.section ? `/projects/$projectId/${l.section}` : "/projects/$projectId") as "/projects/$projectId"}
                params={{ projectId }}
                className={cn(badgeVariants({ variant: "assist" }), "state-layer")}
              >
                {l.label} →
              </Link>
            ))}
            <button
              type="button"
              onClick={() => onAskManager(question ?? "")}
              className={cn(badgeVariants({ variant: "assist" }), "state-layer gap-1.5")}
            >
              <Icon name="person" size={18} /> Ask {managerName} about this
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

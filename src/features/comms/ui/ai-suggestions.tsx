import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Horizontally-scrolling row of tappable suggested questions, above the AI composer. */
export function AiSuggestions({
  questions,
  onAsk,
  disabled,
}: {
  questions: string[];
  onAsk: (question: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pt-3" aria-label="Suggested questions">
      {questions.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onAsk(q)}
          disabled={disabled}
          className={cn(badgeVariants({ variant: "assist" }), "state-layer shrink-0 whitespace-nowrap disabled:opacity-50")}
        >
          {q}
        </button>
      ))}
    </div>
  );
}

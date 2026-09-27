import { useTranslation } from "react-i18next";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { suggestedQuestionKeys } from "@/features/knowledge/domain/assistant";

/** Horizontally-scrolling row of tappable suggested questions, above the AI composer. */
export function AiSuggestions({ onAsk, disabled }: { onAsk: (question: string) => void; disabled?: boolean }) {
  const { t } = useTranslation("knowledge");
  const labels: Record<(typeof suggestedQuestionKeys)[number], string> = {
    next: t("assistant.suggestions.next"),
    blocked: t("assistant.suggestions.blocked"),
    budget: t("assistant.suggestions.budget"),
    finish: t("assistant.suggestions.finish"),
    photos: t("assistant.suggestions.photos"),
  };
  return (
    <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pt-3" aria-label={t("assistant.suggestionsAria")}>
      {suggestedQuestionKeys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onAsk(labels[key])}
          disabled={disabled}
          className={cn(badgeVariants({ variant: "assist" }), "state-layer shrink-0 whitespace-nowrap disabled:opacity-50")}
        >
          {labels[key]}
        </button>
      ))}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useFormat } from "@/i18n";
import { answerSources, linkLabel } from "@/features/knowledge/ui/render-answer";
import type { AiAnswer } from "@/features/knowledge/domain/assistant";

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
  const { t } = useTranslation("knowledge");
  const format = useFormat();
  const sources = answer ? answerSources(answer.sources, { t, format }) : [];
  return (
    <div className="max-w-[92%] text-body-md">
      <div className="leading-relaxed whitespace-pre-wrap">{text}</div>
      {answer && (
        <div className="mt-2 space-y-2">
          {sources.length > 0 && (
            <div className="text-body-sm text-on-surface-variant">{t("assistant.basedOn", { sources: sources.join(" · ") })}</div>
          )}
          <div className="flex flex-wrap gap-2">
            {answer.links.map((l) => (
              <Link
                key={l.section}
                to={(l.section ? `/projects/$projectId/${l.section}` : "/projects/$projectId") as "/projects/$projectId"}
                params={{ projectId }}
                className={cn(badgeVariants({ variant: "assist" }), "state-layer")}
              >
                {linkLabel(l.section, t)}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => onAskManager(question ?? "")}
              className={cn(badgeVariants({ variant: "assist" }), "state-layer gap-1.5")}
            >
              <Icon name="person" size={18} /> {t("assistant.askManager", { name: managerName })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

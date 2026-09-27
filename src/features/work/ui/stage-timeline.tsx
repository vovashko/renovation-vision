import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ProgressBar } from "@/components/ui/progress-bar";
import { statusTone } from "@/lib/status-ui";
import type { Status } from "@/domain/status";

export type TimelineStage = {
  id: string;
  name: string;
  status: Status;
  start: string;
  end: string;
  progress: number;
  lateDays: number;
};

/** The client overview's compact stage list ("Stage list item" in the spec). */
export function StageTimeline({ stages, onSelect }: { stages: TimelineStage[]; onSelect: (stage: TimelineStage) => void }) {
  const { t } = useTranslation(["work", "common"]);
  return (
    <ItemGroup>
      {stages.map((s, i) => (
        <Item key={s.id} asChild size="lg">
          <button type="button" onClick={() => onSelect(s)}>
            <ItemMedia variant="icon" tone={s.status} icon={s.status === "done" ? "check" : undefined}>
              {s.status === "done" ? null : i + 1}
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{s.name}</ItemTitle>
              <ItemDescription>
                {s.start} – {s.end}
              </ItemDescription>
              {s.lateDays > 0 && (
                <Badge variant="attention" size="compact" icon="schedule" className="mt-1.5">
                  {t("common:attention.daysLate", { count: s.lateDays })}
                </Badge>
              )}
            </ItemContent>
            <ItemActions>
              <ProgressBar
                value={s.progress}
                tone={statusTone[s.status]}
                className="w-16 sm:w-[140px]"
                aria-label={t("work:stageRow.progressAriaLabel", { name: s.name })}
              />
              <span className="w-10 text-right text-label-lg tabular-nums">{s.progress}%</span>
            </ItemActions>
          </button>
        </Item>
      ))}
    </ItemGroup>
  );
}

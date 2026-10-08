import { useTranslation } from "react-i18next";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { useFormat } from "@/i18n";
import type { Decision } from "@/lib/database.types";
import { sortDecisions } from "../domain/status";
import { useDeltaText } from "../hooks/use-delta-text";
import { DecisionStatusBadge } from "./decision-status-badge";

/** The project's cases: open ones first, newest first. Each row shows the status, cost and time change. */
export function DecisionList({
  decisions,
  currency,
  isManager,
  onSelect,
}: {
  decisions: Decision[];
  currency: string;
  isManager: boolean;
  onSelect: (decision: Decision) => void;
}) {
  const { t } = useTranslation(["decisions"]);
  const format = useFormat();
  const delta = useDeltaText();

  if (decisions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia icon="fact_check" />
          <EmptyTitle>{t("decisions:list.empty")}</EmptyTitle>
          <EmptyDescription>{isManager ? t("decisions:list.emptyManager") : t("decisions:list.emptyClient")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ItemGroup>
      {sortDecisions(decisions).map((decision) => (
        <Item key={decision.id} size="lg" asChild>
          <button type="button" onClick={() => onSelect(decision)}>
            <ItemContent>
              <ItemTitle size="lg">{decision.title}</ItemTitle>
              <ItemDescription className="line-clamp-none">
                {delta.money(decision.cost_delta, currency)} · {delta.days(decision.days_delta)} ·{" "}
                {t("decisions:list.photos", { count: decision.photos.length })} ·{" "}
                {t("decisions:list.submitted", { date: format.date(decision.created_at, "short") })}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <DecisionStatusBadge status={decision.status} compact />
            </ItemActions>
          </button>
        </Item>
      ))}
    </ItemGroup>
  );
}

import { useTranslation } from "react-i18next";
import { Note } from "@/components/ui/note";
import { useFormat } from "@/i18n";
import { decisionImpact, hasNoImpact, type ImpactCase, type ImpactProject } from "../domain/impact";
import { useDeltaText } from "../hooks/use-delta-text";

/**
 * "Budżet: z 84 500,00 zł do 85 380,00 zł" / "Koniec: z 10 cze do 14 cze", computed from the project's
 * CURRENT budget and end date before the investor decides. Only an accepted case applies it.
 */
export function ImpactPreview({ project, decision }: { project: ImpactProject & { currency: string }; decision: ImpactCase }) {
  const { t } = useTranslation(["decisions"]);
  const format = useFormat();
  const delta = useDeltaText();
  const impact = decisionImpact(project, decision);
  const { currency } = project;
  const none = hasNoImpact(decision);

  return (
    <Note className="space-y-2">
      <h3 className="text-title-sm text-on-surface">{t("decisions:preview.heading")}</h3>
      {none && <p>{t("decisions:preview.noImpact")}</p>}
      {decision.cost_delta !== 0 && (
        <p>
          {t("decisions:preview.budget", {
            from: format.money(impact.budget.from, currency),
            to: format.money(impact.budget.to, currency),
          })}{" "}
          <span className="text-on-surface">({delta.money(impact.budget.delta, currency)})</span>
        </p>
      )}
      {decision.days_delta !== 0 && impact.end.from && impact.end.to && (
        <p>
          {t("decisions:preview.end", { from: format.date(impact.end.from, "long"), to: format.date(impact.end.to, "long") })}{" "}
          <span className="text-on-surface">({delta.days(impact.end.days)})</span>
        </p>
      )}
      {decision.days_delta !== 0 && !impact.end.from && (
        <p>{t("decisions:preview.endUnknown", { days: delta.days(decision.days_delta) })}</p>
      )}
      {impact.budgetBelowZero && (
        <Note tone="error" size="sm">
          {t("decisions:preview.belowZero")}
        </Note>
      )}
      <p className="text-body-sm">{t("decisions:preview.onlyAccepted")}</p>
    </Note>
  );
}

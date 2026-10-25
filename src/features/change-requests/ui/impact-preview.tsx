import { useTranslation } from "react-i18next";
import { Note } from "@/components/ui/note";
import { useFormat } from "@/i18n";
import { requestImpact, type ImpactProject, type ImpactRequest } from "../domain/impact";
import { useDeltaText } from "../hooks/use-delta-text";

/**
 * "Budget: from 120,000 to 128,800 PLN" / "End date: from Mar 3 to Mar 5", computed from the project's CURRENT
 * budget and end date while the request waits. Only an approved request applies it.
 */
export function ImpactPreview({ project, request }: { project: ImpactProject & { currency: string }; request: ImpactRequest }) {
  const { t } = useTranslation(["change-requests"]);
  const format = useFormat();
  const delta = useDeltaText();
  const impact = requestImpact(project, request);
  const { currency } = project;

  return (
    <Note className="space-y-2">
      <h3 className="text-title-sm text-on-surface">{t("change-requests:preview.heading")}</h3>
      {request.cost_delta !== 0 && (
        <p>
          {t("change-requests:preview.budget", {
            from: format.money(impact.budget.from, currency),
            to: format.money(impact.budget.to, currency),
          })}{" "}
          <span className="text-on-surface">({delta.money(impact.budget.delta, currency)})</span>
        </p>
      )}
      {request.days_delta !== 0 && impact.end.from && impact.end.to && (
        <p>
          {t("change-requests:preview.end", { from: format.date(impact.end.from, "long"), to: format.date(impact.end.to, "long") })}{" "}
          <span className="text-on-surface">({delta.days(impact.end.days)})</span>
        </p>
      )}
      {request.days_delta !== 0 && !impact.end.from && (
        <p>{t("change-requests:preview.endUnknown", { days: delta.days(request.days_delta) })}</p>
      )}
      {impact.budgetBelowZero && (
        <Note tone="error" size="sm">
          {t("change-requests:preview.belowZero")}
        </Note>
      )}
      <p className="text-body-sm">{t("change-requests:preview.onlyApproved")}</p>
    </Note>
  );
}

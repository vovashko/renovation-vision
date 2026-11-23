import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable, type DataTableColumn, type DataTableEmpty } from "@/shared/ui/data-table";
import { PageLoading } from "@/components/page-header";
import { useFormat } from "@/i18n";
import { useCostBreakdown } from "../hooks/use-expenses";
import {
  categoryShare,
  isStageOverBudget,
  stageCostTotals,
  stageRemaining,
  type CostBreakdown,
  type StageCost,
} from "../domain/stage-costs";

/**
 * Planned vs spent per stage, and spent per type of cost (decision 10). Both roles see it; a manager's table also has
 * the committed column and the over-budget flag. Aggregates only: the expenses themselves stay on the manager's page.
 */
export function CostBreakdownView({ breakdown, currency, isManager }: { breakdown: CostBreakdown; currency: string; isManager: boolean }) {
  const { t } = useTranslation(["budget"]);
  return (
    <div className="space-y-8">
      <section aria-labelledby="stage-costs-heading">
        <h2 id="stage-costs-heading" className="mb-3 text-title-lg">
          {t("budget:stageCosts.heading")}
        </h2>
        <StageCostTable stages={breakdown.stages} currency={currency} isManager={isManager} />
      </section>
      <section aria-labelledby="category-costs-heading">
        <h2 id="category-costs-heading" className="mb-3 text-title-lg">
          {t("budget:categoryCosts.heading")}
        </h2>
        <CategoryCostList breakdown={breakdown} currency={currency} />
      </section>
    </div>
  );
}

/** Loads the breakdown for the project and shows it. */
export function CostBreakdownSection({ projectId, currency, isManager }: { projectId: string; currency: string; isManager: boolean }) {
  const { data } = useCostBreakdown(projectId);
  if (!data) return <PageLoading />;
  return <CostBreakdownView breakdown={data} currency={currency} isManager={isManager} />;
}

function StageCostTable({ stages, currency, isManager }: { stages: StageCost[]; currency: string; isManager: boolean }) {
  const { t } = useTranslation(["budget", "common"]);
  const format = useFormat();
  const totals = stageCostTotals(stages);
  const money = (n: number) => format.money(n, currency);

  const columns: DataTableColumn<StageCost>[] = [
    {
      key: "stage",
      header: t("budget:stageCosts.stage"),
      cell: (s) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{s.name}</span>
          {isStageOverBudget(s) && (
            <Badge variant="attention" size="compact" icon="warning">
              {t("budget:stageCosts.overBudget")}
            </Badge>
          )}
        </span>
      ),
    },
    { key: "planned", header: t("budget:stageCosts.planned"), cell: (s) => money(s.planned), align: "end", className: "tabular-nums" },
    { key: "spent", header: t("budget:stageCosts.spent"), cell: (s) => money(s.spent), align: "end", className: "tabular-nums" },
    ...(isManager
      ? [
          {
            key: "committed",
            header: t("budget:stageCosts.committed"),
            cell: (s: StageCost) => money(s.committed ?? 0),
            align: "end" as const,
            className: "tabular-nums",
          },
        ]
      : []),
    {
      key: "remaining",
      header: t("budget:stageCosts.remaining"),
      cell: (s) => money(stageRemaining(s)),
      align: "end",
      className: "font-medium tabular-nums",
    },
  ];

  const empty: DataTableEmpty = {
    icon: "payments",
    title: t("budget:stageCosts.emptyTitle"),
    description: t("budget:stageCosts.emptyDescription"),
  };

  return (
    <DataTable
      rows={stages}
      getRowKey={(s) => s.stage_id}
      columns={columns}
      className="min-w-[560px]"
      empty={empty}
      footer={
        <TableRow>
          <TableCell>{t("budget:stageCosts.total")}</TableCell>
          <TableCell className="text-right tabular-nums">{money(totals.planned)}</TableCell>
          <TableCell className="text-right tabular-nums">{money(totals.spent)}</TableCell>
          {isManager && <TableCell className="text-right tabular-nums">{money(totals.committed)}</TableCell>}
          <TableCell className="text-right tabular-nums">{money(totals.remaining)}</TableCell>
        </TableRow>
      }
    />
  );
}

function CategoryCostList({ breakdown, currency }: { breakdown: CostBreakdown; currency: string }) {
  const { t } = useTranslation(["budget"]);
  const format = useFormat();
  if (breakdown.categories.length === 0) return <p className="text-body-md text-on-surface-variant">{t("budget:categoryCosts.empty")}</p>;
  return (
    <ul className="space-y-3">
      {breakdown.categories.map((c) => (
        <li key={c.category} className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-body-lg text-on-surface">{t(`budget:category.${c.category}`)}</span>
            <span className="text-body-lg tabular-nums">{format.money(c.spent, currency)}</span>
          </div>
          <Progress value={categoryShare(breakdown.categories, c)} aria-label={t(`budget:category.${c.category}`)} />
        </li>
      ))}
    </ul>
  );
}

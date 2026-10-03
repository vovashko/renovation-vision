import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable, type DataTableColumn, type DataTableEmpty } from "@/shared/ui/data-table";
import { useFormat } from "@/i18n";
import { expensesTotal } from "@/domain/budget";
import type { Expense, Stage } from "@/lib/database.types";

export function ExpenseTable({
  expenses,
  stages,
  currency,
  onSelect,
  onOpenReceipt,
}: {
  expenses: Expense[];
  stages: Stage[];
  /** The project's currency. */
  currency: string;
  onSelect: (expense: Expense) => void;
  onOpenReceipt: (path: string) => void;
}) {
  const { t } = useTranslation(["budget"]);
  const format = useFormat();
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name ?? t("budget:expenses.noStage");

  // Built outside the JSX tree: `key`/`className`/`align` are column config, not user-visible text.
  const columns: DataTableColumn<Expense>[] = [
    { key: "date", header: t("budget:expenses.date"), cell: (e) => format.date(e.spent_on, "short"), className: "whitespace-nowrap" },
    {
      key: "description",
      header: t("budget:expenses.description"),
      cell: (e) => (
        <>
          <div className="font-medium">{e.description}</div>
          <div className="text-body-sm text-on-surface-variant">
            {t(`budget:category.${e.category}`)}
            {e.vendor_notes ? ` · ${e.vendor_notes}` : ""}
          </div>
        </>
      ),
    },
    { key: "vendor", header: t("budget:expenses.vendor"), cell: (e) => e.vendor || "—" },
    { key: "stage", header: t("budget:expenses.stage"), cell: (e) => stageName(e.stage_id), className: "text-on-surface-variant" },
    {
      key: "amount",
      header: t("budget:expenses.amount"),
      cell: (e) => format.money(e.amount, currency),
      align: "end",
      className: "font-medium whitespace-nowrap tabular-nums",
    },
    {
      key: "receipt",
      header: <span className="sr-only">{t("budget:expenses.openReceipt")}</span>,
      align: "end",
      cell: (e) =>
        e.receipt_path && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={(ev) => {
              ev.stopPropagation();
              onOpenReceipt(e.receipt_path!);
            }}
            aria-label={t("budget:expenses.openReceipt")}
          >
            <Icon name="attach_file" size={20} />
          </Button>
        ),
    },
  ];

  const empty: DataTableEmpty = {
    icon: "receipt_long",
    title: t("budget:expenses.emptyTitle"),
    description: t("budget:expenses.emptyDescription", { amount: format.money(0, currency) }),
  };

  return (
    <DataTable
      rows={expenses}
      getRowKey={(e) => e.id}
      onRowClick={onSelect}
      className="min-w-[720px]"
      empty={empty}
      columns={columns}
      footer={
        <TableRow>
          <TableCell colSpan={4}>{t("budget:expenses.total")}</TableCell>
          <TableCell className="text-right tabular-nums">{format.money(expensesTotal(expenses), currency)}</TableCell>
          <TableCell />
        </TableRow>
      }
    />
  );
}

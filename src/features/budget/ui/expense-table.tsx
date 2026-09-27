import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money, shortDate } from "@/lib/format";
import { expensesTotal } from "@/lib/budget";
import type { Expense, Stage } from "@/lib/database.types";

export function ExpenseTable({
  expenses,
  stages,
  onSelect,
  onOpenReceipt,
}: {
  expenses: Expense[];
  stages: Stage[];
  onSelect: (expense: Expense) => void;
  onOpenReceipt: (path: string) => void;
}) {
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name ?? "—";

  if (expenses.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon" icon="receipt_long" />
          <EmptyDescription>No expenses yet. Spent stays at $0 until you add some.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card>
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>
              <span className="sr-only">Receipt</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((e) => (
            <TableRow key={e.id} onClick={() => onSelect(e)} className="cursor-pointer">
              <TableCell className="whitespace-nowrap text-on-surface-variant">{shortDate(e.spent_on)}</TableCell>
              <TableCell>
                <div className="font-medium">{e.description}</div>
                <div className="text-body-sm text-on-surface-variant">
                  {e.category}
                  {e.vendor_notes ? ` · ${e.vendor_notes}` : ""}
                </div>
              </TableCell>
              <TableCell>{e.vendor || "—"}</TableCell>
              <TableCell className="text-on-surface-variant">{stageName(e.stage_id)}</TableCell>
              <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{money(e.amount)}</TableCell>
              <TableCell className="text-right">
                {e.receipt_path && (
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOpenReceipt(e.receipt_path!);
                    }}
                    aria-label="Open receipt"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
                  >
                    <Icon name="attach_file" size={20} />
                  </button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4}>Total spent</TableCell>
            <TableCell className="text-right tabular-nums">{money(expensesTotal(expenses))}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </Card>
  );
}

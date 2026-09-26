import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PageLoading } from "@/components/page-header";
import { InternalBadge } from "@/components/manager/visibility-badge";
import { ExpenseSheet } from "@/components/expense-sheet";
import { api } from "@/lib/api";
import { keys, useExpenses, useInternal, useProject, useSave, useStages } from "@/lib/queries";
import { money, shortDate } from "@/lib/format";
import { budgetSummary, expensesTotal } from "@/lib/budget";
import type { Expense } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/budget")({
  head: () => ({
    meta: [
      { title: "Budget — RenoVision" },
      { name: "description", content: "Track expenses, vendor notes and receipts. Clients only see the budget and spent totals." },
    ],
  }),
  component: BudgetPage,
});

function BudgetPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: expenses, isLoading } = useExpenses(projectId);
  const { data: stages = [] } = useStages(projectId);
  const [editing, setEditing] = useState<Expense | "new" | null>(null);

  if (isLoading || !expenses || !project) return <PageLoading />;
  const budget = budgetSummary(project);
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name ?? "—";

  const openReceipt = async (path: string) => {
    try {
      window.open(await api.receiptUrl(path), "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title="Budget & expenses"
        description="The client sees the budget and the spent total. Line items, vendors and receipts stay internal."
        actions={
          <Button onClick={() => setEditing("new")} className="gap-2">
            <Icon name="add" size={20} /> Add expense
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BudgetStat icon="euro" label="Budget" value={money(project.budget)} sub="Client sees this" />
        <BudgetStat
          icon="account_balance_wallet"
          label="Spent"
          value={money(project.spent)}
          sub={budget.over ? undefined : "Client sees this total"}
          delta={budget.over ? `↑ ${budget.overPct}% over` : undefined}
          attention={budget.over}
        />
        <BudgetStat icon="savings" label="Remaining" value={money(budget.remaining)} sub={budget.over ? "Over budget" : "Left to spend"} />
        <BudgetStat icon="trending_up" label="Used" value={`${budget.usedPct}%`} sub={`Project ${project.overall_progress}% complete`} />
      </section>
      <Progress value={budget.usedPct} tone={budget.over ? "blocked" : "progress"} className="h-3" />

      <InternalNotes projectId={projectId} />

      <section>
        <h2 className="mb-3 flex flex-wrap items-center gap-2 text-title-lg">
          Expenses <InternalBadge />
        </h2>
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high">
              <Icon name="receipt_long" size={24} className="text-on-surface-variant" />
            </div>
            <p className="mt-2 max-w-xs text-body-md text-on-surface-variant">No expenses yet. Spent stays at $0 until you add some.</p>
          </div>
        ) : (
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
                  <TableRow key={e.id} onClick={() => setEditing(e)} className="cursor-pointer">
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
                            void openReceipt(e.receipt_path!);
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
        )}
      </section>

      <ExpenseSheet projectId={projectId} expense={editing} stages={stages} onClose={() => setEditing(null)} />
    </div>
  );
}

function BudgetStat({
  icon,
  label,
  value,
  sub,
  delta,
  attention,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  attention?: boolean;
}) {
  return (
    <Card attention={attention} className="px-5 py-4">
      <div className="flex items-center gap-2 text-body-md text-on-surface-variant">
        <Icon name={icon} size={20} />
        {label}
      </div>
      <div className="mt-2 text-headline-md">{value}</div>
      {delta ? (
        <div className="mt-1 text-body-sm font-medium text-attention-text">{delta}</div>
      ) : sub ? (
        <div className="mt-1 text-body-sm text-on-surface-variant">{sub}</div>
      ) : null}
    </Card>
  );
}

function InternalNotes({ projectId }: { projectId: string }) {
  const { data } = useInternal(projectId);
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (data) setNotes(data.internal_budget_notes);
  }, [data]);
  const save = useSave(projectId, (n: string) => api.updateInternal(projectId, n), {
    invalidate: [keys.internal(projectId)],
    success: "Internal notes saved",
  });
  return (
    <Card className="border-dashed p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="internal-notes" className="text-title-md">
          Internal budget notes
        </Label>
        <InternalBadge />
      </div>
      <Textarea
        id="internal-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="mt-3 min-h-28"
        placeholder="Contingency, quotes, margins…"
      />
      <div className="mt-3 flex justify-end">
        <Button variant="outline" disabled={save.isPending || notes === data?.internal_budget_notes} onClick={() => save.mutate(notes)}>
          Save notes
        </Button>
      </div>
    </Card>
  );
}

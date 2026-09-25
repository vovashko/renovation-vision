import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Stat } from "@/components/ui/stat-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpenseSheet } from "@/components/expense-sheet";
import { PageHeader, PageLoading } from "@/components/page-header";
import { InternalBadge } from "@/components/visibility-badge";
import { api } from "@/lib/api";
import { keys, useExpenses, useInternal, useProject, useSave, useStages } from "@/lib/queries";
import { money, shortDate } from "@/lib/format";
import { budgetStatus } from "@/lib/attention";
import type { Expense, Stage } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/budget")({
  head: () => ({
    meta: [
      { title: "Budget — Renovision Manager" },
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
  const budget = budgetStatus(project);
  const pct = budget.usedPct;
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name ?? "—";

  const openReceipt = async (path: string) => {
    try {
      window.open(await api.receiptUrl(path), "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <PageHeader
        title="Budget & expenses"
        description="The client sees the budget and the spent total. Line items, vendors and receipts stay internal."
        actions={<Button onClick={() => setEditing("new")} className="min-h-11 gap-2"><Icon name="add" size={20} /> Add expense</Button>}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon="attach_money" label="Budget" value={money(project.budget)} sub="Client sees this" />
        <Stat
          icon="account_balance_wallet"
          label="Spent"
          value={money(project.spent)}
          attention={budget.over}
          delta={budget.over ? `↑ ${budget.overPct}% over` : undefined}
          deltaTone="attention"
          note="Client sees this total"
        />
        <Stat icon="savings" label="Remaining" value={money(project.budget - project.spent)} sub={project.spent > project.budget ? "Over budget" : "Left to spend"} />
        <Stat icon="trending_up" label="Used" value={`${pct}%`} sub={`Project ${project.overall_progress}% complete`} />
      </section>
      <ProgressBar value={pct} />

      <InternalNotes projectId={projectId} />

      <section>
        <h2 className="mb-3 flex flex-wrap items-center gap-2 text-xl font-semibold">Expenses <InternalBadge /></h2>
        {expenses.length === 0 ? (
          <EmptyState icon="receipt_long" text="No expenses yet. Spent stays at $0 until you add some." />
        ) : (
          <div className="relative overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-soft)]">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Description</th>
                  <th className="p-3 font-medium">Vendor</th>
                  <th className="p-3 font-medium">Stage</th>
                  <th className="p-3 text-right font-medium">Amount</th>
                  <th className="p-3"><span className="sr-only">Receipt</span></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} onClick={() => setEditing(e)} className="cursor-pointer border-b last:border-0 hover:bg-muted/50">
                    <td className="whitespace-nowrap p-3 text-muted-foreground">{shortDate(e.spent_on)}</td>
                    <td className="p-3">
                      <div className="font-medium">{e.description}</div>
                      <div className="text-xs text-muted-foreground">{e.category}{e.vendor_notes ? ` · ${e.vendor_notes}` : ""}</div>
                    </td>
                    <td className="p-3">{e.vendor || "—"}</td>
                    <td className="p-3 text-muted-foreground">{stageName(e.stage_id)}</td>
                    <td className="whitespace-nowrap p-3 text-right font-medium tabular-nums">{money(e.amount)}</td>
                    <td className="p-3 text-right">
                      {e.receipt_path && (
                        <button onClick={(ev) => { ev.stopPropagation(); void openReceipt(e.receipt_path!); }} aria-label="Open receipt" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                          <Icon name="attach_file" size={20} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="p-3" colSpan={4}>Total spent</td>
                  <td className="p-3 text-right tabular-nums">{money(expenses.reduce((a, e) => a + e.amount, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <ExpenseSheet projectId={projectId} expense={editing} stages={stages} onClose={() => setEditing(null)} />
    </div>
  );
}

function InternalNotes({ projectId }: { projectId: string }) {
  const { data } = useInternal(projectId);
  const [notes, setNotes] = useState("");
  useEffect(() => { if (data) setNotes(data.internal_budget_notes); }, [data]);
  const save = useSave(projectId, (n: string) => api.updateInternal(projectId, n), { invalidate: [keys.internal(projectId)], success: "Internal notes saved" });
  return (
    <section className="rounded-xl border border-dashed bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="internal-notes" className="text-base font-semibold">Internal budget notes</Label>
        <InternalBadge />
      </div>
      <Textarea id="internal-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-3 min-h-28" placeholder="Contingency, quotes, margins…" />
      <div className="mt-3 flex justify-end">
        <Button variant="outline" disabled={save.isPending || notes === data?.internal_budget_notes} onClick={() => save.mutate(notes)} className="min-h-10">Save notes</Button>
      </div>
    </section>
  );
}

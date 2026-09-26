import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DollarSign, Paperclip, PiggyBank, Plus, Receipt, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Stat } from "@/components/stat-card";
import { ProgressBar } from "@/components/progress-bar";
import { EmptyState } from "@/components/empty-state";
import { Field, FormSheet, selectCls } from "@/components/manager/form-sheet";
import { PageHeader, PageLoading } from "@/components/page-header";
import { InternalBadge } from "@/components/manager/visibility-badge";
import { api, type ExpenseInput } from "@/lib/api";
import { keys, useExpenses, useInternal, useProject, useSave, useStages } from "@/lib/queries";
import { money, shortDate } from "@/lib/format";
import type { Expense, Stage } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/budget")({
  head: () => ({
    meta: [
      { title: "Budget — RenoTrack" },
      { name: "description", content: "Track expenses, vendor notes and receipts. Clients only see the budget and spent totals." },
    ],
  }),
  component: BudgetPage,
});

const categories = ["Labour", "Materials", "Permits", "Disposal", "Equipment", "Other"];

function BudgetPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: expenses, isLoading } = useExpenses(projectId);
  const { data: stages = [] } = useStages(projectId);
  const [editing, setEditing] = useState<Expense | "new" | null>(null);

  if (isLoading || !expenses || !project) return <PageLoading />;
  const pct = project.budget ? Math.round((project.spent / project.budget) * 100) : 0;
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
        actions={<Button onClick={() => setEditing("new")} className="min-h-11 gap-2"><Plus className="h-4 w-4" /> Add expense</Button>}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={DollarSign} label="Budget" value={money(project.budget)} sub="Client sees this" />
        <Stat icon={Wallet} label="Spent" value={money(project.spent)} sub="Client sees this total" />
        <Stat icon={PiggyBank} label="Remaining" value={money(project.budget - project.spent)} sub={project.spent > project.budget ? "Over budget" : "Left to spend"} />
        <Stat icon={TrendingUp} label="Used" value={`${pct}%`} sub={`Project ${project.overall_progress}% complete`} />
      </section>
      <ProgressBar value={pct} size="lg" fill={pct > project.overall_progress + 20 ? "var(--status-blocked)" : "var(--gradient-primary)"} />

      <InternalNotes projectId={projectId} />

      <section>
        <h2 className="mb-3 flex flex-wrap items-center gap-2 text-xl font-semibold">Expenses <InternalBadge /></h2>
        {expenses.length === 0 ? (
          <EmptyState icon={Receipt} text="No expenses yet. Spent stays at $0 until you add some." />
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
                          <Paperclip className="h-4 w-4" />
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

type ExpenseForm = { description: string; vendor: string; vendor_notes: string; category: string; amount: string; spent_on: string; stage_id: string; receiptFile: File | null };

function ExpenseSheet({ projectId, expense, stages, onClose }: { projectId: string; expense: Expense | "new" | null; stages: Stage[]; onClose: () => void }) {
  const isNew = expense === "new";
  const [form, setForm] = useState<ExpenseForm | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = expense === null ? null : isNew ? "new" : expense.id;
  if (key !== lastKey) {
    setLastKey(key);
    setForm(
      expense === null ? null
        : isNew ? { description: "", vendor: "", vendor_notes: "", category: "Materials", amount: "", spent_on: new Date().toISOString().slice(0, 10), stage_id: stages.find((s) => s.status === "progress")?.id ?? "", receiptFile: null }
        : { description: expense.description, vendor: expense.vendor, vendor_notes: expense.vendor_notes, category: expense.category, amount: String(expense.amount), spent_on: expense.spent_on, stage_id: expense.stage_id ?? "", receiptFile: null },
    );
  }
  const inv = { invalidate: [keys.expenses(projectId)] };
  const save = useSave(projectId, (e: ExpenseInput) => api.saveExpense(projectId, e), { ...inv, success: "Expense saved — spent total updated" });
  const remove = useSave(projectId, (e: Expense) => api.deleteExpense(e), { ...inv, success: "Expense deleted" });
  const amount = Number(form?.amount);

  return (
    <FormSheet open={expense !== null} onOpenChange={(v) => !v && onClose()} title={isNew ? "Add expense" : "Edit expense"} description="Only the new spent total reaches the client.">
      {form && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              {
                ...(isNew ? {} : { id: (expense as Expense).id }),
                description: form.description.trim(), vendor: form.vendor.trim(), vendor_notes: form.vendor_notes.trim(), category: form.category,
                amount, spent_on: form.spent_on, stage_id: form.stage_id || null, receiptFile: form.receiptFile,
              },
              { onSuccess: onClose },
            );
          }}
        >
          <Field id="ex-desc" label="Description"><Input id="ex-desc" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-11" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="ex-amount" label="Amount ($)"><Input id="ex-amount" type="number" min={0.01} step={0.01} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-11" /></Field>
            <Field id="ex-date" label="Date"><Input id="ex-date" type="date" required value={form.spent_on} onChange={(e) => setForm({ ...form, spent_on: e.target.value })} className="h-11" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id="ex-cat" label="Category">
              <select id="ex-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={selectCls}>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field id="ex-stage" label="Stage">
              <select id="ex-stage" value={form.stage_id} onChange={(e) => setForm({ ...form, stage_id: e.target.value })} className={selectCls}>
                <option value="">—</option>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <Field id="ex-vendor" label="Vendor"><Input id="ex-vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className="h-11" /></Field>
          <Field id="ex-notes" label="Vendor notes (internal)"><Textarea id="ex-notes" value={form.vendor_notes} onChange={(e) => setForm({ ...form, vendor_notes: e.target.value })} placeholder="Contacts, warranty, payment terms…" /></Field>
          <div className="space-y-2">
            <Label htmlFor="ex-receipt">Receipt (internal){!isNew && (expense as Expense).receipt_path ? " — replace" : ""}</Label>
            <input id="ex-receipt" type="file" accept="image/*,application/pdf" onChange={(e) => setForm({ ...form, receiptFile: e.target.files?.[0] ?? null })} className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-muted file:px-4 file:text-sm file:font-medium" />
          </div>
          <Button type="submit" disabled={save.isPending || !form.description.trim() || !(amount > 0)} className="min-h-11 w-full">{save.isPending ? "Saving…" : "Save expense"}</Button>
          {!isNew && expense && (
            <Button type="button" variant="ghost" className="min-h-11 w-full text-destructive" onClick={() => confirm("Delete this expense?") && remove.mutate(expense, { onSuccess: onClose })}>
              Delete expense
            </Button>
          )}
        </form>
      )}
    </FormSheet>
  );
}

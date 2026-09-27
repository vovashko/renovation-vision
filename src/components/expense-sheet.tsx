import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormSheet } from "@/components/manager/form-sheet";
import { api, type ExpenseInput } from "@/lib/api";
import { keys, useSave } from "@/lib/queries";
import type { Expense, Stage } from "@/lib/database.types";

const categories = ["Labour", "Materials", "Permits", "Disposal", "Equipment", "Other"];

type ExpenseForm = {
  description: string;
  vendor: string;
  vendor_notes: string;
  category: string;
  amount: string;
  spent_on: string;
  stage_id: string;
  receiptFile: File | null;
};

/** Add / edit expense panel: used on the Budget page and by the Overview shortcut. */
export function ExpenseSheet({
  projectId,
  expense,
  stages,
  onClose,
}: {
  projectId: string;
  expense: Expense | "new" | null;
  stages: Stage[];
  onClose: () => void;
}) {
  const isNew = expense === "new";
  const [form, setForm] = useState<ExpenseForm | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = expense === null ? null : isNew ? "new" : expense.id;
  if (key !== lastKey) {
    setLastKey(key);
    setForm(
      expense === null
        ? null
        : isNew
          ? {
              description: "",
              vendor: "",
              vendor_notes: "",
              category: "Materials",
              amount: "",
              spent_on: new Date().toISOString().slice(0, 10),
              stage_id: stages.find((s) => s.status === "progress")?.id ?? "",
              receiptFile: null,
            }
          : {
              description: expense.description,
              vendor: expense.vendor,
              vendor_notes: expense.vendor_notes,
              category: expense.category,
              amount: String(expense.amount),
              spent_on: expense.spent_on,
              stage_id: expense.stage_id ?? "",
              receiptFile: null,
            },
    );
  }
  const inv = { invalidate: [keys.expenses(projectId)] };
  const save = useSave(projectId, (e: ExpenseInput) => api.saveExpense(projectId, e), {
    ...inv,
    success: "Expense saved — spent total updated",
  });
  const remove = useSave(projectId, (e: Expense) => api.deleteExpense(e), { ...inv, success: "Expense deleted" });
  const amount = Number(form?.amount);

  return (
    <FormSheet
      open={expense !== null}
      onOpenChange={(v) => !v && onClose()}
      title={isNew ? "Add expense" : "Edit expense"}
      description="Only the new spent total reaches the client."
    >
      {form && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              {
                ...(isNew ? {} : { id: (expense as Expense).id }),
                description: form.description.trim(),
                vendor: form.vendor.trim(),
                vendor_notes: form.vendor_notes.trim(),
                category: form.category,
                amount,
                spent_on: form.spent_on,
                stage_id: form.stage_id || null,
                receiptFile: form.receiptFile,
              },
              { onSuccess: onClose },
            );
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ex-desc">Description</FieldLabel>
              <Input id="ex-desc" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="ex-amount">Amount ($)</FieldLabel>
                <Input
                  id="ex-amount"
                  type="number"
                  min={0.01}
                  step={0.01}
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ex-date">Date</FieldLabel>
                <Input
                  id="ex-date"
                  type="date"
                  required
                  value={form.spent_on}
                  onChange={(e) => setForm({ ...form, spent_on: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="ex-cat">Category</FieldLabel>
                <NativeSelect id="ex-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {categories.map((c) => (
                    <NativeSelectOption key={c}>{c}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="ex-stage">Stage</FieldLabel>
                <NativeSelect id="ex-stage" value={form.stage_id} onChange={(e) => setForm({ ...form, stage_id: e.target.value })}>
                  <NativeSelectOption value="">—</NativeSelectOption>
                  {stages.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {s.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="ex-vendor">Vendor</FieldLabel>
              <Input id="ex-vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ex-notes">Vendor notes (internal)</FieldLabel>
              <Textarea
                id="ex-notes"
                value={form.vendor_notes}
                onChange={(e) => setForm({ ...form, vendor_notes: e.target.value })}
                placeholder="Contacts, warranty, payment terms…"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ex-receipt">
                Receipt (internal){expense && expense !== "new" && expense.receipt_path ? " — replace" : ""}
              </FieldLabel>
              <input
                id="ex-receipt"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setForm({ ...form, receiptFile: e.target.files?.[0] ?? null })}
                className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-muted file:px-4 file:text-sm file:font-medium"
              />
            </Field>
            <Button type="submit" disabled={save.isPending || !form.description.trim() || !(amount > 0)} className="w-full">
              {save.isPending ? "Saving…" : "Save expense"}
            </Button>
            {!isNew && expense && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive"
                onClick={() => confirm("Delete this expense?") && remove.mutate(expense, { onSuccess: onClose })}
              >
                Delete expense
              </Button>
            )}
          </FieldGroup>
        </form>
      )}
    </FormSheet>
  );
}

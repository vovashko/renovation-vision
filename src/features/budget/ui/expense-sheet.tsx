import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldGroup } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FileInput } from "@/components/ui/file-input";
import { FormSheet } from "@/shared/ui/form-sheet";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { useConfirm } from "@/shared/ui/use-confirm";
import { EXPENSE_CATEGORIES, expenseSchema, type ExpenseFormInput } from "../domain/schemas";
import { useDeleteExpense, useSaveExpense } from "../hooks/use-expenses";
import type { Expense, Stage } from "@/lib/database.types";

function defaultsFor(expense: Expense | "new", stages: Stage[]): ExpenseFormInput {
  if (expense === "new") {
    return {
      description: "",
      amount: "",
      spent_on: new Date().toISOString().slice(0, 10),
      category: "Materials",
      stage_id: stages.find((s) => s.status === "progress")?.id ?? "",
      vendor: "",
      vendor_notes: "",
      receiptFile: null,
    };
  }
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(expense.category)
    ? (expense.category as ExpenseFormInput["category"])
    : "Other";
  return {
    description: expense.description,
    amount: String(expense.amount),
    spent_on: expense.spent_on,
    category,
    stage_id: expense.stage_id ?? "",
    vendor: expense.vendor,
    vendor_notes: expense.vendor_notes,
    receiptFile: null,
  };
}

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
  const { t } = useTranslation(["budget", "common"]);
  const confirm = useConfirm();
  const isNew = expense === "new";
  const key = expense === null ? null : isNew ? "new" : expense.id;
  const form = useZodForm(expenseSchema, defaultsFor(expense ?? "new", stages));

  useEffect(() => {
    if (expense !== null) form.reset(defaultsFor(expense, stages));
    // Re-run only when the sheet targets a different expense (or opens/closes), not on every stages/form change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const save = useSaveExpense(projectId);
  const remove = useDeleteExpense(projectId);

  const onSubmit = form.handleSubmit((values) => {
    save.mutate(
      {
        ...(isNew ? {} : { id: (expense as Expense).id }),
        description: values.description,
        vendor: values.vendor,
        vendor_notes: values.vendor_notes,
        category: values.category,
        amount: values.amount,
        spent_on: values.spent_on,
        stage_id: values.stage_id || null,
        receiptFile: values.receiptFile,
      },
      { onSuccess: onClose },
    );
  });

  const onDelete = async () => {
    if (isNew || expense === null) return;
    if (await confirm({ title: t("budget:sheet.deleteConfirmTitle"), destructive: true })) {
      remove.mutate(expense, { onSuccess: onClose });
    }
  };

  return (
    <FormSheet
      open={expense !== null}
      onOpenChange={(v) => !v && onClose()}
      title={isNew ? t("budget:sheet.addTitle") : t("budget:sheet.editTitle")}
      description={t("budget:sheet.description")}
    >
      {expense !== null && (
        <form noValidate onSubmit={onSubmit}>
          <FieldGroup>
            <FormField control={form.control} name="description" label={t("budget:sheet.descriptionLabel")}>
              {(field) => <Input {...field} />}
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="amount" label={t("budget:sheet.amount")}>
                {(field) => <Input {...field} inputMode="decimal" />}
              </FormField>
              <FormField control={form.control} name="spent_on" label={t("budget:sheet.date")}>
                {(field) => <Input type="date" {...field} />}
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="category" label={t("budget:sheet.category")}>
                {(field) => (
                  <NativeSelect {...field}>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <NativeSelectOption key={c} value={c}>
                        {t(`budget:category.${c}`)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
              <FormField control={form.control} name="stage_id" label={t("budget:sheet.stage")}>
                {(field) => (
                  <NativeSelect {...field}>
                    <NativeSelectOption value="">{t("budget:sheet.stageNone")}</NativeSelectOption>
                    {stages.map((s) => (
                      <NativeSelectOption key={s.id} value={s.id}>
                        {s.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            </div>
            <FormField control={form.control} name="vendor" label={t("budget:sheet.vendor")}>
              {(field) => <Input {...field} />}
            </FormField>
            <FormField control={form.control} name="vendor_notes" label={t("budget:sheet.vendorNotes")}>
              {(field) => <Textarea {...field} placeholder={t("budget:sheet.vendorNotesPlaceholder")} />}
            </FormField>
            <FormField
              control={form.control}
              name="receiptFile"
              label={!isNew && (expense as Expense).receipt_path ? t("budget:sheet.receiptReplace") : t("budget:sheet.receipt")}
            >
              {({ value: _value, onChange, ...field }) => (
                <FileInput
                  {...field}
                  variant="compact"
                  accept="image/*,application/pdf"
                  onChange={(e) => onChange(e.target.files?.[0] ?? null)}
                />
              )}
            </FormField>
            <Button type="submit" disabled={save.isPending} className="w-full">
              {save.isPending ? t("common:state.saving") : t("budget:sheet.save")}
            </Button>
            {!isNew && (
              <Button type="button" variant="ghost" className="w-full text-destructive" onClick={() => void onDelete()}>
                {t("budget:sheet.delete")}
              </Button>
            )}
          </FieldGroup>
        </form>
      )}
    </FormSheet>
  );
}

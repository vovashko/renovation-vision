import { z } from "zod";

// The current fixed category list. Values are stored as-is on `expenses.category` (a free-text
// column with existing rows in this exact casing), so they stay stable while the labels translate
// through the `budget:category.*` i18n keys.
export const EXPENSE_CATEGORIES = ["Labour", "Materials", "Permits", "Disposal", "Equipment", "Other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * Amount as typed text so a Polish decimal comma ("12,50") works alongside a dot ("12.50").
 * `expenses.amount` has a DB check `amount > 0`, mirrored here so the form catches it first.
 */
const amountInput = z
  .string()
  .trim()
  .min(1, "common:form.required")
  .transform((value) => value.replace(",", "."))
  .pipe(z.coerce.number({ message: "common:form.invalid" }).positive("budget:sheet.amountPositive"));

export const expenseSchema = z.object({
  description: z.string().trim().min(1, "common:form.required"),
  amount: amountInput,
  spent_on: z.string().trim().min(1, "common:form.required"),
  category: z.enum(EXPENSE_CATEGORIES, { message: "common:form.invalid" }),
  stage_id: z.string().trim(),
  vendor: z.string().trim(),
  vendor_notes: z.string().trim(),
  receiptFile: z.instanceof(File).nullable(),
});

/** What the form fields hold (pre-validation: amount is still text). */
export type ExpenseFormInput = z.input<typeof expenseSchema>;
/** What `form.handleSubmit` hands the submit handler (amount parsed to a number). */
export type ExpenseFormValues = z.output<typeof expenseSchema>;

import { z } from "zod";
import type { CostCategory } from "@/lib/database.types";

// The values of the `cost_category` enum (`expenses.category`), in the order the form offers them. The
// labels translate through the `budget:category.*` i18n keys. `satisfies` keeps the list in step with
// the database enum: a value the enum doesn't have fails the typecheck.
export const EXPENSE_CATEGORIES = [
  "labour",
  "materials",
  "permits",
  "disposal",
  "equipment",
  "other",
] as const satisfies readonly CostCategory[];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * Amount as the number `MoneyInput` emits (null while empty or unparseable; it parses "12,50" and
 * "12.50" itself). `expenses.amount` has a DB check `amount > 0`, mirrored here so the form catches it first.
 */
const amountInput = z
  .number()
  .nullable()
  .pipe(z.number({ message: "common:form.required" }).positive("budget:sheet.amountPositive"));

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

/** What the form fields hold (pre-validation: amount may be null). */
export type ExpenseFormInput = z.input<typeof expenseSchema>;
/** What `form.handleSubmit` hands the submit handler (amount parsed to a number). */
export type ExpenseFormValues = z.output<typeof expenseSchema>;

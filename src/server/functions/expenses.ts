// Atomic delete for an expense: delete the row, then (if it had one) remove its receipt from the
// `project-internal` bucket. Manager-only; context.supabase acts as the user, so RLS applies. See
// README → Server functions & security, and src/server/functions/media.ts for the same pattern.
import { z } from "zod";
import { authedFn } from "../fn";
import { requireProjectRole } from "../middleware/auth";
import { deleteExpenseHandler } from "./expenses.server";

const deleteExpenseInput = z.object({ projectId: z.string().uuid(), expenseId: z.string().uuid() });

export const deleteExpense = authedFn({ method: "POST" })
  .middleware([requireProjectRole((input: { projectId: string }) => input.projectId, "manager")])
  .validator(deleteExpenseInput)
  .handler(async ({ data, context }) => deleteExpenseHandler(data, context));

// deleteExpense's handler body, split out so it's directly unit-testable (the same pattern as
// functions/me.server.ts and functions/media.server.ts): delete the row, then (if it had one) remove
// its receipt from the `project-internal` bucket. A storage failure is logged as an orphan marker
// but the call still reports success — the row is gone either way.
import { logger } from "@/lib/logger";
import { INTERNAL_BUCKET } from "@/lib/supabase";
import { ServerFnError } from "../errors";
import type { AuthContext } from "../middleware/auth";

export async function deleteExpenseHandler(data: { projectId: string; expenseId: string }, context: AuthContext): Promise<{ ok: true }> {
  const { data: expense, error: selectError } = await context.supabase
    .from("expenses")
    .select("receipt_path")
    .eq("id", data.expenseId)
    .eq("project_id", data.projectId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (!expense) throw new ServerFnError("NOT_FOUND", "Expense not found");

  const { error: deleteError } = await context.supabase.from("expenses").delete().eq("id", data.expenseId);
  if (deleteError) throw deleteError;

  if (!expense.receipt_path) return { ok: true };

  const { error: storageError } = await context.supabase.storage.from(INTERNAL_BUCKET).remove([expense.receipt_path]);
  if (storageError) {
    logger.error("expense row deleted but receipt removal failed (orphan)", {
      expenseId: data.expenseId,
      projectId: data.projectId,
      path: expense.receipt_path,
      err: storageError,
    });
  }
  return { ok: true };
}

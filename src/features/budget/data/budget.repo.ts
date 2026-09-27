// The only module in features/budget that imports supabase-js. Ported from `src/lib/api.ts`
// (read-only reference — that file is shared across the W2c tasks and isn't edited here); the
// storage path convention below is load-bearing for the `project-internal` bucket's RLS policies
// (supabase/migrations/20260924000400_storage.sql), so it's kept exactly.
import { supabase, INTERNAL_BUCKET } from "@/lib/supabase";
import { fileExt } from "@/domain/text";
import type { Expense, ProjectInternal } from "@/lib/database.types";

export type ExpenseInput = Partial<Omit<Expense, "project_id" | "receipt_path">> & { receiptFile?: File | null };

type Result<T> = { data: T | null; error: { message: string } | null };

async function must<T>(p: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

const toAmountNumber = (row: Expense) => ({ ...row, amount: Number(row.amount) });

/** `<project_id>/receipts/<uuid>.<ext>` — the exact convention the storage RLS depends on. */
const receiptPath = (projectId: string, file: File) => `${projectId}/receipts/${crypto.randomUUID()}.${fileExt(file.name)}`;

async function uploadReceipt(projectId: string, file: File): Promise<string> {
  const path = receiptPath(projectId, file);
  await must(supabase.storage.from(INTERNAL_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false }));
  return path;
}

export const budgetRepo = {
  async listExpenses(projectId: string): Promise<Expense[]> {
    const rows = (await must(
      supabase.from("expenses").select("*").eq("project_id", projectId).order("spent_on", { ascending: false }),
    )) as Expense[];
    return rows.map(toAmountNumber);
  },

  async saveExpense(projectId: string, input: ExpenseInput): Promise<void> {
    const { id: expenseId, receiptFile, ...rest } = input;
    const receipt_path = receiptFile ? await uploadReceipt(projectId, receiptFile) : undefined;
    const row = { ...rest, ...(receipt_path ? { receipt_path } : {}) };
    if (expenseId) {
      await must(supabase.from("expenses").update(row).eq("id", expenseId));
    } else {
      await must(supabase.from("expenses").insert({ ...row, project_id: projectId, created_by: await currentUserId() }));
    }
  },

  /** Deletes the row first; the receipt object is only removed once that succeeds. */
  async deleteExpense(expense: Expense): Promise<void> {
    await must(supabase.from("expenses").delete().eq("id", expense.id));
    if (expense.receipt_path) await supabase.storage.from(INTERNAL_BUCKET).remove([expense.receipt_path]);
  },

  /** Signed URL, 10 minutes — just long enough to view or download one receipt. */
  async receiptUrl(path: string): Promise<string> {
    const data = await must(supabase.storage.from(INTERNAL_BUCKET).createSignedUrl(path, 60 * 10));
    return data.signedUrl;
  },

  async getInternal(projectId: string): Promise<ProjectInternal> {
    return must(supabase.from("project_internal").select("*").eq("project_id", projectId).single()) as Promise<ProjectInternal>;
  },

  async updateInternal(projectId: string, notes: string): Promise<void> {
    await must(supabase.from("project_internal").upsert({ project_id: projectId, internal_budget_notes: notes }));
  },
};

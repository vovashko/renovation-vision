import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { keys } from "@/shared/query-keys";
import type { Expense } from "@/lib/database.types";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { budgetRepo, type ExpenseInput } from "../data/budget.repo";

export const useExpenses = (projectId: string) =>
  useQuery({ queryKey: keys.expenses(projectId), queryFn: () => budgetRepo.listExpenses(projectId) });

/** `projects.spent` is maintained by a DB trigger, so a save also refreshes the project and projects list. */
export function useSaveExpense(projectId: string) {
  const { t } = useTranslation(["budget"]);
  return useMutationWithToast((input: ExpenseInput) => budgetRepo.saveExpense(projectId, input), {
    invalidate: [keys.expenses(projectId), keys.project(projectId), keys.projects],
    success: t("budget:sheet.saved"),
  });
}

export function useDeleteExpense(projectId: string) {
  const { t } = useTranslation(["budget"]);
  return useMutationWithToast((expense: Expense) => budgetRepo.deleteExpense(expense), {
    invalidate: [keys.expenses(projectId), keys.project(projectId), keys.projects],
    success: t("budget:sheet.deleted"),
  });
}

/** Opens a receipt's signed URL in a new tab, toasting on failure (e.g. an expired/removed object). */
export function useOpenReceipt() {
  const { t } = useTranslation(["common"]);
  return async (path: string) => {
    try {
      window.open(await budgetRepo.receiptUrl(path), "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message || t("common:errors.generic"));
    }
  };
}

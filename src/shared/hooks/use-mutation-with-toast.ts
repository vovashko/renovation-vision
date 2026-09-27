import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export type MutationWithToastOptions<V, R> = {
  /** Query keys to refetch once the mutation settles (success or error). A function gets the variables. */
  invalidate?: QueryKey[] | ((vars: V) => QueryKey[]);
  /** Success toast, already translated. Omit for no toast. */
  success?: string | ((vars: V, result: R) => string);
  /** Error toast. Defaults to the error's message, or `common:errors.generic` when it has none. */
  error?: string | ((error: Error, vars: V) => string);
  /** Runs after the success toast (close a sheet, reset a form). */
  onSuccess?: (result: R, vars: V) => void;
};

/**
 * A TanStack mutation that toasts its outcome and refreshes the affected queries:
 *
 *   const save = useMutationWithToast(workRepo.updateStage, {
 *     invalidate: [workKeys.stages(projectId)],
 *     success: t("work:stageSaved"),
 *   });
 *   save.mutate(values);
 */
export function useMutationWithToast<V, R = unknown>(fn: (vars: V) => Promise<R>, opts: MutationWithToastOptions<V, R> = {}) {
  const qc = useQueryClient();
  const { t } = useTranslation(["common"]);
  return useMutation<R, Error, V>({
    mutationFn: fn,
    onSuccess: (result, vars) => {
      const message = typeof opts.success === "function" ? opts.success(vars, result) : opts.success;
      if (message) toast.success(message);
      opts.onSuccess?.(result, vars);
    },
    onError: (error, vars) => {
      const message = typeof opts.error === "function" ? opts.error(error, vars) : opts.error;
      toast.error(message ?? (error.message || t("common:errors.generic")));
    },
    onSettled: (_result, _error, vars) => {
      const keys = typeof opts.invalidate === "function" ? opts.invalidate(vars) : (opts.invalidate ?? []);
      for (const queryKey of keys) void qc.invalidateQueries({ queryKey });
    },
  });
}

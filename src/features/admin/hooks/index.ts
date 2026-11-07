import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { useAuth, useSessionRefresh } from "@/lib/auth";
import { listAccounts } from "@/server/functions/staff";
import { StaffRepoError, staffRepo } from "../data/staff.repo";
import { accountTypeError, type AccountType, type StaffAccount } from "../domain/accounts";

export const staffKeys = { accounts: ["staffAccounts"] as const };

/** Every account, for the Staff page (server function, staff only). */
export const useStaffAccounts = () => useQuery({ queryKey: staffKeys.accounts, queryFn: () => listAccounts() });

/** The translated reason a `set_account_type` call failed. */
export function useAccountTypeErrorText(): (error: Error) => string {
  const { t } = useTranslation(["admin", "common"]);
  return useCallback(
    (error) => {
      const reason = error instanceof StaffRepoError ? accountTypeError(error) : null;
      return reason ? t(`admin:staff.errors.${reason}`) : t("common:errors.generic");
    },
    [t],
  );
}

/** Makes an account a manager (`admin`) or a client, as the user. Changing your own type refreshes the session. */
export function useSetAccountType() {
  const { t } = useTranslation(["admin"]);
  const errorText = useAccountTypeErrorText();
  const { userId } = useAuth();
  const refresh = useSessionRefresh();
  return useMutationWithToast(
    (vars: { account: StaffAccount; type: AccountType }) => staffRepo.setAccountType(vars.account.id, vars.type),
    {
      invalidate: [staffKeys.accounts],
      success: ({ account, type }) => t(type === "admin" ? "staff.promoted" : "staff.demoted", { name: account.name || account.email }),
      error: errorText,
      onSuccess: (_result, { account }) => {
        if (account.id === userId) void refresh();
      },
    },
  );
}

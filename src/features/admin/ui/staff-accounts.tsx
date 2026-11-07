import { useTranslation } from "react-i18next";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { PageLoading } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/shared/ui/use-confirm";
import { useSetAccountType, useStaffAccounts } from "../hooks";
import { otherType, type StaffAccount } from "../domain/accounts";
import { AccountItem } from "./account-item";

/** The Staff page's list: every account, with "Make manager" / "Make client" behind a confirmation. */
export function StaffAccounts() {
  const { t } = useTranslation(["admin"]);
  const { userId } = useAuth();
  const { data: accounts, isLoading } = useStaffAccounts();
  const setType = useSetAccountType();
  const confirm = useConfirm();

  if (isLoading || !accounts) return <PageLoading />;
  if (accounts.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon" icon="group" />
          <EmptyDescription>{t("staff.empty")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const toggle = async (account: StaffAccount) => {
    const type = otherType(account.accountType);
    const name = account.name || account.email;
    const demote = type === "client";
    const ok = await confirm({
      title: t(demote ? "staff.demoteConfirmTitle" : "staff.promoteConfirmTitle", { name }),
      description: demote
        ? t(account.id === userId ? "staff.demoteSelfConfirmDescription" : "staff.demoteConfirmDescription")
        : t("staff.promoteConfirmDescription"),
      confirmLabel: demote ? t("staff.makeClient") : t("staff.makeManager"),
      destructive: demote,
    });
    if (ok) setType.mutate({ account, type });
  };

  return (
    <ItemGroup>
      {accounts.map((account) => (
        <AccountItem
          key={account.id}
          account={account}
          isSelf={account.id === userId}
          busy={setType.isPending}
          onToggle={() => void toggle(account)}
        />
      ))}
    </ItemGroup>
  );
}

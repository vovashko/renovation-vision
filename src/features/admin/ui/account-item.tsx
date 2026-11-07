import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChatAvatar } from "@/components/ui/avatar-initials";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import type { StaffAccount } from "../domain/accounts";

/** One row of the Staff page: who, their account type, and the switch to the other type. */
export function AccountItem({
  account,
  isSelf,
  busy,
  onToggle,
}: {
  account: StaffAccount;
  isSelf: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation(["admin"]);
  const name = account.name || account.email;
  const isManager = account.accountType === "admin";
  return (
    <Item variant="plain">
      <ItemMedia>
        <ChatAvatar name={name || "?"} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="truncate">
          {name}
          {isSelf && <span className="text-on-surface-variant"> {t("staff.you")}</span>}
        </ItemTitle>
        {account.name && <ItemDescription className="truncate">{account.email}</ItemDescription>}
      </ItemContent>
      <ItemActions className="flex-wrap justify-end">
        {account.invited && <Badge variant="outline">{t("staff.invited")}</Badge>}
        <Badge variant={isManager ? "secondary" : "outline"}>{isManager ? t("staff.manager") : t("staff.client")}</Badge>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onToggle}
          aria-label={t(isManager ? "staff.makeClientAria" : "staff.makeManagerAria", { name })}
        >
          {isManager ? t("staff.makeClient") : t("staff.makeManager")}
        </Button>
      </ItemActions>
    </Item>
  );
}

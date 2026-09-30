import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { useMe } from "../hooks/use-me";

/** Account section on /settings: the two-factor status and account type, as the server reports them (getMe). */
export function AccountCard({ className }: { className?: string }) {
  const { t } = useTranslation(["settings", "common"]);
  const me = useMe();

  const pending = me.isPending ? t("common:state.loading") : t("account.unavailable");
  const twoFactor = me.data ? (me.data.aal === "aal2" ? t("account.twoFactor.on") : t("account.twoFactor.off")) : pending;
  const accountType = me.data ? t(me.data.accountType === "manager" ? "account.type.manager" : "account.type.client") : pending;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t("account.title")}</CardTitle>
        <CardDescription>{t("account.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Item variant="plain" data-testid="two-factor-status">
          <ItemMedia variant="icon" icon="verified_user" />
          <ItemContent>
            <ItemTitle>{t("account.twoFactor.title")}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Badge variant={me.data?.aal === "aal2" ? "status-done" : "outline"}>{twoFactor}</Badge>
          </ItemActions>
        </Item>
        <Item variant="plain" data-testid="account-type">
          <ItemMedia variant="icon" icon="badge" />
          <ItemContent>
            <ItemTitle>{t("account.type.title")}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Badge variant="outline">{accountType}</Badge>
          </ItemActions>
        </Item>
      </CardContent>
    </Card>
  );
}

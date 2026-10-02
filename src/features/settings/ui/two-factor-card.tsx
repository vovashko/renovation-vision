import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Note } from "@/components/ui/note";
import { isStaffAccount, mfaHref, useMfaFactors, useStaffMfaRequired, useUnenrollFactor, type MfaFactor } from "@/features/auth/hooks";
import { authErrorKey } from "@/features/auth/domain/auth-errors";
import { useFormat } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/shared/ui/use-confirm";
import { removeRule, type RemoveRule } from "../domain/two-factor";

const HERE = "/settings/security";

function FactorRow({ factor, rule }: { factor: MfaFactor; rule: RemoveRule }) {
  const { t } = useTranslation(["settings", "common", "auth"]);
  const format = useFormat();
  const confirm = useConfirm();
  const unenroll = useUnenrollFactor();
  const verified = factor.status === "verified";

  const remove = async () => {
    const ok = await confirm({ title: t("twoFactor.removeConfirm"), description: t("twoFactor.removeConfirmBody"), destructive: true });
    if (!ok) return;
    unenroll.mutate(factor.id, {
      onSuccess: () => toast.success(t("twoFactor.removed")),
      onError: (error) => toast.error(t(authErrorKey(error))),
    });
  };

  return (
    <Item variant="plain" data-testid="mfa-factor">
      <ItemMedia variant="icon" icon="phonelink_lock" />
      <ItemContent>
        <ItemTitle>{factor.friendlyName ?? t("twoFactor.unnamed")}</ItemTitle>
        <ItemDescription>
          {t(verified ? "twoFactor.added" : "twoFactor.addedUnfinished", { date: format.date(factor.createdAt, "long") })}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {rule === "verify-first" ? (
          <Button asChild variant="ghost" size="sm">
            <a href={mfaHref("challenge", HERE)}>{t("twoFactor.verifyToRemove")}</a>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" disabled={rule === "locked" || unenroll.isPending} onClick={() => void remove()}>
            {t("common:actions.remove")}
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}

/** Settings → Security: 2FA status, the authenticator apps (TOTP factors), add and remove. */
export function TwoFactorCard({ className }: { className?: string }) {
  const { t } = useTranslation(["settings"]);
  const { aal, profile } = useAuth();
  const factors = useMfaFactors();
  const staff = isStaffAccount(profile?.account_type);
  const required = useStaffMfaRequired(staff);
  const list = factors.data ?? [];
  const verifiedCount = list.filter((f) => f.status === "verified").length;
  const enforcedForMe = staff && required.data === true;
  const canAdd = verifiedCount === 0 || aal === "aal2";

  return (
    <Card className={className} data-testid="two-factor-card">
      <CardHeader>
        <CardTitle>{t("twoFactor.title")}</CardTitle>
        <CardDescription>{t("twoFactor.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Item variant="plain">
          <ItemMedia variant="icon" icon="verified_user" />
          <ItemContent>
            <ItemTitle>{t("twoFactor.status")}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Badge variant={verifiedCount > 0 ? "status-done" : "outline"} data-testid="two-factor-enabled">
              {factors.isPending ? t("account.unavailable") : verifiedCount > 0 ? t("twoFactor.enabled") : t("twoFactor.disabled")}
            </Badge>
          </ItemActions>
        </Item>
        {list.length > 0 && (
          <ItemGroup>
            {list.map((factor) => (
              <FactorRow key={factor.id} factor={factor} rule={removeRule(factor, { aal, verifiedCount, enforcedForMe })} />
            ))}
          </ItemGroup>
        )}
        {enforcedForMe && verifiedCount <= 1 && <Note size="sm">{t("twoFactor.requiredForStaff")}</Note>}
        <Button asChild variant={verifiedCount > 0 ? "outline" : "default"} className="self-start">
          {canAdd ? (
            <Link to="/mfa/enroll" search={{ redirect: HERE }}>
              {verifiedCount > 0 ? t("twoFactor.addAnother") : t("twoFactor.setUp")}
            </Link>
          ) : (
            <a href={mfaHref("challenge", HERE)}>{t("twoFactor.verifyNow")}</a>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

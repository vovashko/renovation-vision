import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { useFormat } from "@/i18n";
import { useConfirm } from "@/shared/ui/use-confirm";
import { inviteStatus } from "../domain/invites";
import { usePendingInvites, useResendInvite, useRevokeInvite, type PendingInvitation } from "../hooks/invites";

function InviteItem({
  invitation,
  busy,
  onResend,
  onRevoke,
}: {
  invitation: PendingInvitation;
  busy: boolean;
  onResend: () => void;
  onRevoke: () => void;
}) {
  const { t } = useTranslation(["people"]);
  const { date } = useFormat();
  const expired = inviteStatus({ accepted_at: null, revoked_at: null, expires_at: invitation.expires_at }) === "expired";
  return (
    <Item variant="plain">
      <ItemMedia variant="icon" icon="forward_to_inbox" />
      <ItemContent>
        <ItemTitle className="truncate">{invitation.email}</ItemTitle>
        <ItemDescription>
          {expired ? t("invite.expired") : t("invite.expiresOn", { date: date(invitation.expires_at, "long") })}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="flex-wrap justify-end">
        <Badge variant={invitation.role === "manager" ? "secondary" : "outline"}>{t(`invite.role.${invitation.role}`)}</Badge>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onResend}
          aria-label={t("invite.resendAria", { email: invitation.email })}
        >
          {t("invite.resend")}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          disabled={busy}
          onClick={onRevoke}
          aria-label={t("invite.revokeAria", { email: invitation.email })}
        >
          <Icon name="close" size={20} />
        </Button>
      </ItemActions>
    </Item>
  );
}

/** The Team page's open invitations, with "Send again" and "Withdraw". Renders nothing when there are none. */
export function PendingInvites({ projectId }: { projectId: string }) {
  const { t } = useTranslation(["people"]);
  const { data: invitations = [] } = usePendingInvites(projectId);
  const resend = useResendInvite(projectId);
  const revoke = useRevokeInvite(projectId);
  const confirm = useConfirm();
  if (invitations.length === 0) return null;

  const withdraw = async (invitation: PendingInvitation) => {
    const ok = await confirm({
      title: t("invite.revokeConfirmTitle", { email: invitation.email }),
      description: t("invite.revokeConfirmDescription"),
      confirmLabel: t("invite.revoke"),
      destructive: true,
    });
    if (ok) revoke.mutate(invitation);
  };

  return (
    <section aria-labelledby="pending-invites-heading" className="space-y-2">
      <h2 id="pending-invites-heading" className="text-title-md">
        {t("invite.pendingHeading")}
      </h2>
      <ItemGroup>
        {invitations.map((invitation) => (
          <InviteItem
            key={invitation.id}
            invitation={invitation}
            busy={resend.isPending || revoke.isPending}
            onResend={() => resend.mutate(invitation)}
            onRevoke={() => void withdraw(invitation)}
          />
        ))}
      </ItemGroup>
    </section>
  );
}

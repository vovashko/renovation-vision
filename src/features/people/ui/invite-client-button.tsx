import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useInviteClient, useResendInvite, type PendingInvitation } from "../hooks/invites";

/**
 * The client card's invite action: "Send invite" while the client's email has no account, "Send again" while the
 * invitation is open.
 */
export function InviteClientButton({
  projectId,
  email,
  invitation,
}: {
  projectId: string;
  email: string;
  invitation: PendingInvitation | undefined;
}) {
  const { t } = useTranslation(["people"]);
  const invite = useInviteClient(projectId);
  const resend = useResendInvite(projectId);
  const busy = invite.isPending || resend.isPending;
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      disabled={busy}
      onClick={() => (invitation ? resend.mutate(invitation) : invite.mutate({ email }))}
    >
      <Icon name={invitation ? "refresh" : "send"} size={18} />
      {invitation ? t("client.resendInvite") : t("client.sendInvite")}
    </Button>
  );
}

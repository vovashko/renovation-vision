import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Note } from "@/components/ui/note";
import { useInviteManager } from "../hooks/invites";

/** In the Add person sheet, when the manager's email has no account yet: invite them (staff only, checked by the server). */
export function InviteManagerPrompt({ projectId, email, onSent }: { projectId: string; email: string; onSent: () => void }) {
  const { t } = useTranslation(["people"]);
  const invite = useInviteManager(projectId);
  return (
    <div className="space-y-3">
      <Note>{t("invite.managerNoAccount", { email })}</Note>
      <Button
        type="button"
        variant="tonal"
        className="w-full gap-2"
        disabled={invite.isPending}
        onClick={() => invite.mutate({ email }, { onSuccess: onSent })}
      >
        <Icon name="send" size={20} />
        {t("invite.sendManagerInvite")}
      </Button>
    </div>
  );
}

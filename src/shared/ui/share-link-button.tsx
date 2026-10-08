import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { investorShareUrl } from "@/features/auth/domain/guards";
import { useNavRole } from "./nav-role";

/**
 * Managers only: copies the current project page's URL so they can send it to the investor, who
 * signs in with their client account and lands there. Renders nothing for clients or on a
 * manager-only section (the link would just bounce a client to the overview).
 */
export function ShareLinkButton() {
  const { t } = useTranslation(["common"]);
  const role = useNavRole();
  const { pathname, searchStr } = useRouterState({ select: (r) => r.location });
  if (role !== "manager") return null;
  const label = t("common:shareLink.label");

  const copy = async () => {
    const url = investorShareUrl(window.location.origin, pathname, searchStr);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("common:shareLink.copied"));
    } catch {
      toast.error(t("common:shareLink.failed"));
    }
  };

  if (investorShareUrl("", pathname, searchStr) === null) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={label} onClick={copy} className="shrink-0">
          <Icon name="link" size={22} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

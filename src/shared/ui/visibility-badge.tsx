import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

/**
 * Tells the manager what the client will (not) see. Reuses the status chip's `done` (filled) / `pending`
 * (hollow, dashed) treatment as a visible / hidden metaphor, rather than a bespoke chip style.
 */
export function VisibilityBadge({ visible, hiddenLabel }: { visible: boolean; hiddenLabel?: string }) {
  const { t } = useTranslation(["common"]);
  return visible ? (
    <Badge variant="status-done" size="compact" icon="visibility">
      {t("visibility.clientSees")}
    </Badge>
  ) : (
    <Badge variant="status-pending" size="compact" icon="visibility_off">
      {hiddenLabel ?? t("visibility.hiddenFromClient")}
    </Badge>
  );
}

export function InternalBadge() {
  const { t } = useTranslation(["common"]);
  return (
    <Badge variant="status-pending" size="compact" icon="lock">
      {t("visibility.internalNote")}
    </Badge>
  );
}

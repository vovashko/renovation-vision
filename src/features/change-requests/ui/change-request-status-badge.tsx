import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { ChangeRequestStatus } from "@/lib/database.types";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

// Pending is hollow (not decided yet), approved is done, rejected is blocked.
const VARIANT: Record<ChangeRequestStatus, BadgeVariant> = {
  pending: "status-pending",
  question: "status-pending",
  accepted: "status-done",
  rejected: "status-blocked",
};

/** "Awaiting approval" · "Approved" · "Rejected". */
export function ChangeRequestStatusBadge({ status, compact = false }: { status: ChangeRequestStatus; compact?: boolean }) {
  const { t } = useTranslation(["change-requests"]);
  return (
    <Badge variant={VARIANT[status]} size={compact ? "compact" : "default"}>
      {t(`change-requests:status.${status}`)}
    </Badge>
  );
}

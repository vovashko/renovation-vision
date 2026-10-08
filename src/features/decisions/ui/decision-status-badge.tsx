import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { DecisionStatus } from "@/lib/database.types";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

// Pending is hollow (not decided yet), a question is in progress, accepted is done, rejected is blocked.
const VARIANT: Record<DecisionStatus, BadgeVariant> = {
  pending: "status-pending",
  question: "status-progress",
  accepted: "status-done",
  rejected: "status-blocked",
};

/** 'Oczekuje na decyzję' · 'Zaakceptowano' · 'Odrzucono' · 'Pytanie do wyjaśnienia'. */
export function DecisionStatusBadge({ status, compact = false }: { status: DecisionStatus; compact?: boolean }) {
  const { t } = useTranslation(["decisions"]);
  return (
    <Badge variant={VARIANT[status]} size={compact ? "compact" : "default"}>
      {t(`decisions:status.${status}`)}
    </Badge>
  );
}

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { Decision } from "@/lib/database.types";
import { canReopen } from "../domain/status";
import { useReopenDecision } from "../hooks";

/** A rejected case goes back to 'Oczekuje na decyzję' (logged in its history); either side can do it. Accepted is final. */
export function ReopenButton({ projectId, decision }: { projectId: string; decision: Decision }) {
  const { t } = useTranslation(["decisions"]);
  const reopen = useReopenDecision(projectId);
  if (!canReopen(decision.status)) return null;
  return (
    <Button variant="outline" disabled={reopen.isPending} onClick={() => reopen.mutate(decision.id)} className="gap-2">
      <Icon name="undo" size={20} /> {t("decisions:actions.reopen")}
    </Button>
  );
}

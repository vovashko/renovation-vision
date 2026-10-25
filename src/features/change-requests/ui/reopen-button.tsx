import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { ChangeRequest } from "@/lib/database.types";
import { canReopen } from "../domain/status";
import { useReopenChangeRequest } from "../hooks";

/** A rejected request goes back to "Awaiting approval" (logged in its history); either side can do it. Approved is final. */
export function ReopenButton({ projectId, request }: { projectId: string; request: ChangeRequest }) {
  const { t } = useTranslation(["change-requests"]);
  const reopen = useReopenChangeRequest(projectId);
  if (!canReopen(request.status)) return null;
  return (
    <Button variant="outline" disabled={reopen.isPending} onClick={() => reopen.mutate(request.id)} className="gap-2">
      <Icon name="undo" size={20} /> {t("change-requests:actions.reopen")}
    </Button>
  );
}

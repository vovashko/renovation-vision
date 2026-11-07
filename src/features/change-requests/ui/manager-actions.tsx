import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { ChangeRequest } from "@/lib/database.types";
import { canEdit } from "../domain/status";

/** The manager edits a request until the client decides (a decided request is locked: submit a new one). */
export function ManagerActions({ request, onEdit }: { request: ChangeRequest; onEdit: () => void }) {
  const { t } = useTranslation(["change-requests"]);
  if (!canEdit(request.status)) return null;
  return (
    <Button variant="outline" onClick={onEdit} className="gap-2">
      <Icon name="edit" size={20} /> {t("change-requests:actions.edit")}
    </Button>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useFormat } from "@/i18n";
import { useConfirm } from "@/shared/ui/use-confirm";
import type { ChangeRequest } from "@/lib/database.types";
import { requestImpact, type ImpactProject } from "../domain/impact";
import { canDecide } from "../domain/status";
import { useAcceptChangeRequest, useRejectChangeRequest } from "../hooks";
import { useDeltaText } from "../hooks/use-delta-text";
import { ManagerContactLink } from "./manager-contact-link";
import { RejectDialog } from "./reject-dialog";

/**
 * What the client can do with a pending request: approve it (a confirm dialog that spells out the new budget and
 * end date) or reject it (a reason is required). Questions go to the manager on WhatsApp.
 */
export function ClientActions({
  projectId,
  request,
  project,
}: {
  projectId: string;
  request: ChangeRequest;
  project: ImpactProject & { currency: string };
}) {
  const { t } = useTranslation(["change-requests"]);
  const format = useFormat();
  const delta = useDeltaText();
  const confirm = useConfirm();
  const accept = useAcceptChangeRequest(projectId);
  const reject = useRejectChangeRequest(projectId);
  const [rejecting, setRejecting] = useState(false);

  if (!canDecide(request.status)) return <ManagerContactLink projectId={projectId} />;
  const impact = requestImpact(project, request);

  // "Budget changes from 120,000 to 128,800 PLN. The end date changes from Mar 3 to Mar 5. This can't be undone."
  const describe = () =>
    [
      request.cost_delta !== 0 &&
        t("change-requests:approve.budget", {
          from: format.money(impact.budget.from, project.currency),
          to: format.money(impact.budget.to, project.currency),
        }),
      request.days_delta !== 0 &&
        (impact.end.from && impact.end.to
          ? t("change-requests:approve.end", { from: format.date(impact.end.from, "long"), to: format.date(impact.end.to, "long") })
          : t("change-requests:approve.endUnknown", { days: delta.days(request.days_delta) })),
      t("change-requests:approve.final"),
    ]
      .filter(Boolean)
      .join(" ");

  const onApprove = async () => {
    const ok = await confirm({
      title: t("change-requests:approve.confirmTitle"),
      description: describe(),
      confirmLabel: t("change-requests:approve.confirmLabel"),
    });
    if (ok) accept.mutate(request.id);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void onApprove()} disabled={impact.budgetBelowZero || accept.isPending} className="gap-2">
          <Icon name="check" size={20} /> {t("change-requests:actions.approve")}
        </Button>
        <Button variant="outline" onClick={() => setRejecting(true)} className="gap-2">
          <Icon name="close" size={20} /> {t("change-requests:actions.reject")}
        </Button>
        <ManagerContactLink projectId={projectId} />
      </div>
      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        pending={reject.isPending}
        onSubmit={(reason) => reject.mutate({ requestId: request.id, reason }, { onSuccess: () => setRejecting(false) })}
      />
    </>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useCooldown } from "@/features/auth/hooks";
import { useFormat } from "@/i18n";
import { useConfirm } from "@/shared/ui/use-confirm";
import type { Decision } from "@/lib/database.types";
import { decisionImpact, type ImpactProject } from "../domain/impact";
import { rejectSchema } from "../domain/schemas";
import { canAsk, canDecide } from "../domain/status";
import { useAskQuestion, useRejectDecision, useRequestDecisionCode } from "../hooks";
import { CodeDialog } from "./code-dialog";
import { TextDialog } from "./text-dialog";

/** Seconds before another code can be requested for the same case. */
const RESEND_COOLDOWN_S = 60;

/**
 * What the investor can do with an open case: accept (a "Czy na pewno?" confirmation, then the emailed 6-digit
 * code), reject (a reason is required) or ask a question. Nothing renders once the case is decided.
 */
export function InvestorActions({
  projectId,
  decision,
  project,
}: {
  projectId: string;
  decision: Decision;
  project: ImpactProject & { currency: string };
}) {
  const { t } = useTranslation(["decisions"]);
  const format = useFormat();
  const confirm = useConfirm();
  const request = useRequestDecisionCode(projectId);
  const ask = useAskQuestion(projectId);
  const reject = useRejectDecision(projectId);
  const cooldown = useCooldown(`decision-code-${decision.id}`, RESEND_COOLDOWN_S);
  const [codeOpen, setCodeOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  if (!canDecide(decision.status)) return null;
  const impact = decisionImpact(project, decision);

  const requestCode = () =>
    request.mutate(decision.id, {
      onSuccess: () => {
        cooldown.start();
        setCodeOpen(true);
      },
    });

  const describe = () => {
    const { currency } = project;
    const budget = { budgetFrom: format.money(impact.budget.from, currency), budgetTo: format.money(impact.budget.to, currency) };
    if (decision.days_delta !== 0 && impact.end.from && impact.end.to) {
      return t("decisions:accept.confirmWithEnd", {
        ...budget,
        endFrom: format.date(impact.end.from, "long"),
        endTo: format.date(impact.end.to, "long"),
      });
    }
    return decision.cost_delta === 0 ? t("decisions:accept.confirmNoImpact") : t("decisions:accept.confirmWithImpact", budget);
  };

  const onAccept = async () => {
    // A code was sent a moment ago: go straight back to entering it.
    if (cooldown.remaining > 0) return setCodeOpen(true);
    const ok = await confirm({
      title: t("decisions:accept.confirmTitle"),
      description: describe(),
      confirmLabel: t("decisions:accept.confirmLabel"),
    });
    if (ok) requestCode();
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void onAccept()} disabled={impact.budgetBelowZero || request.isPending} className="gap-2">
          <Icon name="check" size={20} /> {t("decisions:actions.accept")}
        </Button>
        {canAsk(decision.status) && (
          <Button variant="outline" onClick={() => setAsking(true)} className="gap-2">
            <Icon name="help" size={20} /> {t("decisions:actions.ask")}
          </Button>
        )}
        <Button variant="outline" onClick={() => setRejecting(true)} className="gap-2 text-destructive">
          <Icon name="close" size={20} /> {t("decisions:actions.reject")}
        </Button>
      </div>

      <CodeDialog
        open={codeOpen}
        onOpenChange={setCodeOpen}
        projectId={projectId}
        decisionId={decision.id}
        resend={{ onResend: requestCode, pending: request.isPending, remaining: cooldown.remaining }}
      />
      <TextDialog
        open={asking}
        onOpenChange={setAsking}
        title={t("decisions:message.askTitle")}
        description={t("decisions:message.askDescription")}
        label={t("decisions:message.askLabel")}
        submitLabel={t("decisions:actions.send")}
        pending={ask.isPending}
        onSubmit={(text) => ask.mutate({ decisionId: decision.id, text }, { onSuccess: () => setAsking(false) })}
      />
      <TextDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={t("decisions:message.rejectTitle")}
        description={t("decisions:message.rejectDescription")}
        label={t("decisions:message.rejectLabel")}
        submitLabel={t("decisions:message.rejectSubmit")}
        schema={rejectSchema}
        pending={reject.isPending}
        onSubmit={(reason) => reject.mutate({ decisionId: decision.id, reason }, { onSuccess: () => setRejecting(false) })}
      />
    </>
  );
}

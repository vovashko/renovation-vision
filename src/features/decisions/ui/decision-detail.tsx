import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Note } from "@/components/ui/note";
import { useFormat } from "@/i18n";
import { useMembers } from "@/features/people/hooks";
import type { Decision, Member } from "@/lib/database.types";
import type { ImpactProject } from "../domain/impact";
import { isOpen } from "../domain/status";
import { useDecisionEvents } from "../hooks";
import { useDeltaText } from "../hooks/use-delta-text";
import { DecisionHistory } from "./decision-history";
import { DecisionPhotos } from "./decision-photos";
import { DecisionStatusBadge } from "./decision-status-badge";
import { ImpactPreview } from "./impact-preview";
import { InvestorActions } from "./investor-actions";
import { ManagerActions } from "./manager-actions";
import { ReopenButton } from "./reopen-button";

const nameFrom = (members: Member[], id: string | null) => (id ? (members.find((m) => m.user_id === id)?.profile.full_name ?? null) : null);

/**
 * One case: description, photos, cost and time, the impact preview (while it is open), the actions for the
 * signed-in role and the whole history. A decided case is read-only (a rejected one can be reopened).
 */
export function DecisionDetail({
  projectId,
  decision,
  project,
  isManager,
  onBack,
  onEdit,
}: {
  projectId: string;
  decision: Decision;
  project: ImpactProject & { currency: string };
  isManager: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation(["decisions", "common"]);
  const format = useFormat();
  const delta = useDeltaText();
  const { data: events = [] } = useDecisionEvents(projectId, decision.id);
  const { data: members = [] } = useMembers(projectId);
  const lastQuestion = [...events].reverse().find((e) => e.kind === "question")?.text;
  const decider = nameFrom(members, decision.decided_by);

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <Icon name="arrow_back" size={20} /> {t("decisions:page.back")}
      </Button>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-headline-sm text-on-surface">{decision.title}</h2>
        <DecisionStatusBadge status={decision.status} />
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-label-lg text-on-surface-variant">{t("decisions:detail.cost")}</dt>
          <dd className="text-title-lg text-on-surface">{delta.money(decision.cost_delta, project.currency)}</dd>
        </div>
        <div>
          <dt className="text-label-lg text-on-surface-variant">{t("decisions:detail.days")}</dt>
          <dd className="text-title-lg text-on-surface">{delta.days(decision.days_delta)}</dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h3 className="text-title-md text-on-surface">{t("decisions:detail.description")}</h3>
        <p className="text-body-lg whitespace-pre-wrap text-on-surface-variant">
          {decision.description || t("decisions:detail.noDescription")}
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-title-md text-on-surface">{t("decisions:detail.photos")}</h3>
        <DecisionPhotos photos={decision.photos} />
      </section>

      {decision.status === "rejected" && (
        <Note>
          <strong className="text-on-surface">{t("decisions:detail.rejectionReason")}</strong>
          <p className="whitespace-pre-wrap">{decision.decision_reason}</p>
        </Note>
      )}
      {decision.decided_at && (
        <p className="text-body-md text-on-surface-variant">
          {t("decisions:detail.decidedBy", {
            name: decider ?? t("decisions:history.former"),
            date: format.date(decision.decided_at, "long"),
          })}
        </p>
      )}

      {isOpen(decision.status) && <ImpactPreview project={project} decision={decision} />}
      {decision.status === "accepted" && <Note>{t("decisions:detail.lockedNote")}</Note>}

      <div className="flex flex-wrap gap-2">
        {isManager ? (
          <ManagerActions projectId={projectId} decision={decision} lastQuestion={lastQuestion} onEdit={onEdit} />
        ) : (
          <InvestorActions projectId={projectId} decision={decision} project={project} />
        )}
        <ReopenButton projectId={projectId} decision={decision} />
      </div>

      <section className="space-y-2">
        <h3 className="text-title-md text-on-surface">{t("decisions:history.heading")}</h3>
        <DecisionHistory events={events} nameOf={(id) => nameFrom(members, id)} />
      </section>
    </div>
  );
}

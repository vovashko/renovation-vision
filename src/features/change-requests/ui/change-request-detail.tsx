import { useTranslation } from "react-i18next";
import { Note } from "@/components/ui/note";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useFormat } from "@/i18n";
import { useMembers } from "@/features/people/hooks";
import type { ChangeRequest, Member } from "@/lib/database.types";
import type { ImpactProject } from "../domain/impact";
import { isPending } from "../domain/status";
import { useChangeRequestEvents } from "../hooks";
import { useDeltaText } from "../hooks/use-delta-text";
import { ChangeRequestHistory } from "./change-request-history";
import { ChangeRequestStatusBadge } from "./change-request-status-badge";
import { ClientActions } from "./client-actions";
import { ImpactPreview } from "./impact-preview";
import { ManagerActions } from "./manager-actions";
import { ReopenButton } from "./reopen-button";

const nameFrom = (members: Member[], id: string | null) => (id ? (members.find((m) => m.user_id === id)?.profile.full_name ?? null) : null);

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label-lg text-on-surface-variant">{label}</dt>
      <dd className="text-title-lg text-on-surface">{value}</dd>
    </div>
  );
}

function DetailBody({
  projectId,
  request,
  project,
  isManager,
  stageName,
  onEdit,
}: {
  projectId: string;
  request: ChangeRequest;
  project: ImpactProject & { currency: string };
  isManager: boolean;
  stageName?: string;
  onEdit: () => void;
}) {
  const { t } = useTranslation(["change-requests"]);
  const format = useFormat();
  const delta = useDeltaText();
  const { data: events = [] } = useChangeRequestEvents(projectId, request.id);
  const { data: members = [] } = useMembers(projectId);
  const decider = nameFrom(members, request.decided_by);

  return (
    <div className="space-y-6">
      <ChangeRequestStatusBadge status={request.status} />
      <dl className="grid gap-4 sm:grid-cols-2">
        {request.cost_delta !== 0 && (
          <Fact label={t("change-requests:detail.cost")} value={delta.money(request.cost_delta, project.currency)} />
        )}
        {request.days_delta !== 0 && <Fact label={t("change-requests:detail.days")} value={delta.days(request.days_delta)} />}
        {stageName && <Fact label={t("change-requests:detail.stage")} value={stageName} />}
      </dl>

      <section className="space-y-2">
        <h3 className="text-title-md text-on-surface">{t("change-requests:detail.description")}</h3>
        <p className="text-body-lg whitespace-pre-wrap text-on-surface-variant">
          {request.description || t("change-requests:detail.noDescription")}
        </p>
      </section>

      {request.status === "rejected" && (
        <Note>
          <strong className="text-on-surface">{t("change-requests:detail.rejectionReason")}</strong>
          <p className="whitespace-pre-wrap">{request.decision_reason}</p>
        </Note>
      )}
      {request.decided_at && (
        <p className="text-body-md text-on-surface-variant">
          {t("change-requests:detail.decidedBy", {
            name: decider ?? t("change-requests:history.former"),
            date: format.date(request.decided_at, "long"),
          })}
        </p>
      )}

      {isPending(request.status) && <ImpactPreview project={project} request={request} />}
      {request.status === "accepted" && <Note>{t("change-requests:detail.lockedNote")}</Note>}

      <div className="flex flex-wrap gap-2">
        {isManager ? (
          <ManagerActions request={request} onEdit={onEdit} />
        ) : (
          <ClientActions projectId={projectId} request={request} project={project} />
        )}
        <ReopenButton projectId={projectId} request={request} />
      </div>

      <section className="space-y-2">
        <h3 className="text-title-md text-on-surface">{t("change-requests:history.heading")}</h3>
        <ChangeRequestHistory events={events} nameOf={(id) => nameFrom(members, id)} />
      </section>
    </div>
  );
}

/**
 * One change request in a side sheet (bottom sheet on phones): the change, the stage, the description, the impact
 * preview while it waits, the actions for the signed-in role and the whole history. `request` null closes it;
 * "missing" shows that the linked request can't be found.
 */
export function ChangeRequestSheet({
  projectId,
  request,
  project,
  isManager,
  stageName,
  onClose,
  onEdit,
}: {
  projectId: string;
  request: ChangeRequest | "missing" | null;
  project: ImpactProject & { currency: string };
  isManager: boolean;
  stageName?: string;
  onClose: () => void;
  onEdit: (request: ChangeRequest) => void;
}) {
  const { t } = useTranslation(["change-requests"]);
  const found = request && request !== "missing" ? request : null;
  return (
    <Sheet open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="responsive" className="max-h-[90dvh] overflow-y-auto md:max-h-none">
        <SheetHeader>
          <SheetTitle>{found ? found.title : t("change-requests:section.heading")}</SheetTitle>
          <SheetDescription className={found ? "sr-only" : undefined}>
            {found ? t("change-requests:section.heading") : t("change-requests:detail.notFound")}
          </SheetDescription>
        </SheetHeader>
        {found && (
          <DetailBody
            projectId={projectId}
            request={found}
            project={project}
            isManager={isManager}
            stageName={stageName}
            onEdit={() => onEdit(found)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

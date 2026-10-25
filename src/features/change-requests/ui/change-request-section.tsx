import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import type { ChangeRequest } from "@/lib/database.types";
import type { ImpactProject } from "../domain/impact";
import type { ChangeKind } from "../domain/schemas";
import { inPlace, type ChangeRequestPlace } from "../domain/status";
import { useChangeRequests } from "../hooks";
import { ChangeRequestSheet } from "./change-request-detail";
import { ChangeRequestFormSheet } from "./change-request-form-sheet";
import { ChangeRequestList } from "./change-request-list";

// Named at module scope so the linter does not mistake this sentinel for user-facing text.
const NEW_REQUEST = "new";
/** "New change request" pre-chooses what changes: the cost in Budget, the schedule in Progress. */
const DEFAULT_KIND: Record<ChangeRequestPlace, ChangeKind> = { budget: "cost", progress: "days" };

/**
 * The change-requests section of Budget (cost changes) and Progress (day changes): the list, the request sheet
 * (opened by `selectedId`, the page's `?request=` search param) and, for managers, "New change request" with
 * the kind pre-chosen. A client sees the section only when something is listed here.
 */
export function ChangeRequestSection({
  projectId,
  place,
  project,
  isManager,
  stages,
  selectedId,
  onSelect,
}: {
  projectId: string;
  place: ChangeRequestPlace;
  project: ImpactProject & { currency: string };
  isManager: boolean;
  stages: { id: string; name: string }[];
  selectedId: string | undefined;
  onSelect: (id: string | undefined) => void;
}) {
  const { t } = useTranslation(["change-requests"]);
  const { data: requests } = useChangeRequests(projectId);
  const [editing, setEditing] = useState<ChangeRequest | "new" | null>(null);
  if (!requests) return null;

  const listed = inPlace(requests, place);
  const stageNames = Object.fromEntries(stages.map((s) => [s.id, s.name]));
  // The sheet opens on any request of the project (a link may point here), not only the ones listed.
  const selected = selectedId ? (requests.find((r) => r.id === selectedId) ?? "missing") : null;
  if (!isManager && listed.length === 0 && !selected) return null;

  return (
    <section aria-labelledby={`change-requests-${place}`} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`change-requests-${place}`} className="text-title-lg">
            {t("change-requests:section.heading")}
          </h2>
          <p className="text-body-md text-on-surface-variant">
            {place === "budget" ? t("change-requests:section.descriptionBudget") : t("change-requests:section.descriptionProgress")}
          </p>
        </div>
        {isManager && (
          <Button variant="outline" onClick={() => setEditing(NEW_REQUEST)} className="gap-2">
            <Icon name="add" size={20} /> {t("change-requests:section.new")}
          </Button>
        )}
      </div>

      {listed.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia icon="fact_check" />
            <EmptyTitle>{t("change-requests:section.emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {isManager ? t("change-requests:section.emptyManager") : t("change-requests:section.emptyClient")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ChangeRequestList
          requests={requests}
          place={place}
          currency={project.currency}
          isManager={isManager}
          stageNames={stageNames}
          onSelect={(r) => onSelect(r.id)}
        />
      )}

      <ChangeRequestSheet
        projectId={projectId}
        request={selected}
        project={project}
        isManager={isManager}
        stageName={selected && selected !== "missing" && selected.stage_id ? stageNames[selected.stage_id] : undefined}
        onClose={() => onSelect(undefined)}
        onEdit={(r) => {
          onSelect(undefined);
          setEditing(r);
        }}
      />
      {isManager && (
        <ChangeRequestFormSheet
          projectId={projectId}
          request={editing}
          defaultKind={DEFAULT_KIND[place]}
          currency={project.currency}
          stages={stages}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

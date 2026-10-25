import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { useFormat } from "@/i18n";
import type { ChangeRequest } from "@/lib/database.types";
import { groupRequests, inPlace, type ChangeRequestPlace } from "../domain/status";
import { useDeltaText } from "../hooks/use-delta-text";
import { ChangeRequestStatusBadge } from "./change-request-status-badge";

function RequestRow({
  request,
  currency,
  stageName,
  onSelect,
}: {
  request: ChangeRequest;
  currency: string;
  stageName?: string;
  onSelect: (request: ChangeRequest) => void;
}) {
  const { t } = useTranslation(["change-requests"]);
  const format = useFormat();
  const delta = useDeltaText();
  const parts = [
    request.cost_delta !== 0 && delta.money(request.cost_delta, currency),
    request.days_delta !== 0 && delta.days(request.days_delta),
    stageName && t("change-requests:list.stage", { name: stageName }),
    t("change-requests:list.submitted", { date: format.date(request.created_at, "short") }),
  ].filter(Boolean);
  return (
    <Item size="lg" asChild>
      <button type="button" onClick={() => onSelect(request)}>
        <ItemContent>
          <ItemTitle size="lg">{request.title}</ItemTitle>
          <ItemDescription className="line-clamp-none">{parts.join(" · ")}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <ChangeRequestStatusBadge status={request.status} compact />
        </ItemActions>
      </button>
    </Item>
  );
}

function RequestGroup({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-title-md">{heading}</h3>
      <ItemGroup>{children}</ItemGroup>
    </section>
  );
}

/**
 * The change requests listed in one place: Budget shows those with a cost change, Progress those with a day
 * change (a request with both is in both). "Awaiting your approval" first, then the history. Renders nothing
 * when the place has no request (the section shows the empty state).
 */
export function ChangeRequestList({
  requests,
  place,
  currency,
  isManager,
  stageNames = {},
  onSelect,
}: {
  requests: ChangeRequest[];
  place: ChangeRequestPlace;
  currency: string;
  isManager: boolean;
  /** Stage names by id, for the linked stage. */
  stageNames?: Record<string, string>;
  onSelect: (request: ChangeRequest) => void;
}) {
  const { t } = useTranslation(["change-requests"]);
  const { pending, history } = groupRequests(inPlace(requests, place));
  const row = (r: ChangeRequest) => (
    <RequestRow
      key={r.id}
      request={r}
      currency={currency}
      stageName={r.stage_id ? stageNames[r.stage_id] : undefined}
      onSelect={onSelect}
    />
  );
  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <RequestGroup heading={isManager ? t("change-requests:list.awaitingManager") : t("change-requests:list.awaitingClient")}>
          {pending.map(row)}
        </RequestGroup>
      )}
      {history.length > 0 && <RequestGroup heading={t("change-requests:list.history")}>{history.map(row)}</RequestGroup>}
    </div>
  );
}

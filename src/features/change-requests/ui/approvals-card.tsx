import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import type { ChangeRequest } from "@/lib/database.types";
import { approvalsCard, homeOf } from "../domain/status";
import { useChangeRequests } from "../hooks";
import { useDeltaText } from "../hooks/use-delta-text";

function NewestRequest({ projectId, request, currency }: { projectId: string; request: ChangeRequest; currency: string }) {
  const delta = useDeltaText();
  const change = [
    request.cost_delta !== 0 && delta.money(request.cost_delta, currency),
    request.days_delta !== 0 && delta.days(request.days_delta),
  ]
    .filter(Boolean)
    .join(" · ");
  const linkClass = "font-medium underline-offset-2 hover:underline";
  return (
    <li>
      {homeOf(request) === "budget" ? (
        <Link to="/projects/$projectId/budget" params={{ projectId }} search={{ request: request.id }} className={linkClass}>
          {request.title}
        </Link>
      ) : (
        <Link
          to="/projects/$projectId/progress"
          params={{ projectId }}
          search={{ view: "timeline", request: request.id }}
          className={linkClass}
        >
          {request.title}
        </Link>
      )}{" "}
      <span>({change})</span>
    </li>
  );
}

/**
 * The client overview's "Awaiting your approval" card: how many change requests wait, the newest few (each opens
 * where it is listed) and a link to Budget. Renders nothing when nothing waits.
 */
export function ApprovalsCard({ projectId, currency }: { projectId: string; currency: string }) {
  const { t } = useTranslation(["change-requests"]);
  const { data: requests = [] } = useChangeRequests(projectId);
  const card = approvalsCard(requests);
  if (!card) return null;
  return (
    <Banner
      variant="attention"
      icon="pending_actions"
      title={t("change-requests:approvals.title")}
      action={
        <Button asChild variant="ghost" size="sm">
          <Link to="/projects/$projectId/budget" params={{ projectId }}>
            {t("change-requests:approvals.review")}
          </Link>
        </Button>
      }
    >
      {t("change-requests:approvals.count", { count: card.count })}
      <ul className="mt-1 list-disc pl-5">
        {card.newest.map((r) => (
          <NewestRequest key={r.id} projectId={projectId} request={r} currency={currency} />
        ))}
      </ul>
    </Banner>
  );
}

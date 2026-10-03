import { Link, type LinkProps } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { useFormat } from "@/i18n";
import { cn } from "@/lib/utils";
import type { ProjectIssue } from "../domain/project-issues";

type Tone = "blocked" | "attention" | "check";

const toneByKind: Record<ProjectIssue["kind"], Tone> = {
  stage_blocked: "blocked",
  room_blocked: "blocked",
  stage_late: "attention",
  over_budget: "attention",
  inconsistency: "check",
};

const issueIcon: Record<Tone, string> = { blocked: "block", attention: "schedule", check: "rule" };
const issueIconClass: Record<Tone, string> = {
  blocked: "bg-status-blocked-container text-on-status-blocked-container",
  attention: "bg-attention-container text-attention",
  check: "bg-surface-container-high text-on-surface-variant",
};

const rowClass =
  "state-layer -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-md px-3 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";

type Row = { title: string; detail?: string; link?: Pick<LinkProps, "to" | "params" | "search" | "hash">; onClick?: () => void };

/** The manager overview's "needs attention" list: blocked/late stages and rooms, the budget, then data checks. */
export function IssuesList({
  issues,
  projectId,
  currency,
  onOpenDetails,
}: {
  issues: ProjectIssue[];
  projectId: string;
  /** The project's currency, for the over-budget amounts. */
  currency: string;
  onOpenDetails: () => void;
}) {
  const { t } = useTranslation(["projects", "work", "common"]);
  const format = useFormat();
  if (!issues.length) return null;

  const params = { projectId };

  function describeIssue(issue: ProjectIssue): Row {
    switch (issue.kind) {
      case "stage_blocked":
        return {
          title: t("issues.stageBlocked", { name: issue.name }),
          detail: issue.note ?? undefined,
          link: { to: "/projects/$projectId/stages", params, hash: issue.id },
        };
      case "room_blocked":
        return {
          title: t("issues.roomBlocked", { name: issue.name }),
          detail: issue.note ?? undefined,
          link: { to: "/projects/$projectId/plan", params, search: { room: issue.id } },
        };
      case "stage_late":
        return {
          title: t("issues.stageLate", { name: issue.name, late: t("common:attention.daysLate", { count: issue.daysLate }) }),
          detail: t("issues.stageLateDetail", { date: format.date(issue.endDate, "short"), progress: issue.progress }),
          link: { to: "/projects/$projectId/stages", params, hash: issue.id },
        };
      case "over_budget":
        return {
          title: t("common:attention.overBudget", { pct: issue.overPct }),
          detail: t("issues.overBudgetDetail", {
            spent: format.money(issue.spent, currency),
            budget: format.money(issue.budget, currency),
          }),
          link: { to: "/projects/$projectId/budget", params },
        };
      case "inconsistency": {
        const w = issue.issue;
        const title = t(`work:consistency.${w.kind}`, w);
        if (w.to === "overview") return { title, onClick: onOpenDetails };
        return { title, link: { to: w.to === "stages" ? "/projects/$projectId/stages" : "/projects/$projectId/plan", params } };
      }
    }
  }

  return (
    <section aria-labelledby="issues-heading">
      <h3 id="issues-heading" className="text-title-md">
        {t("issues.heading")}
      </h3>
      <ul className="mt-2 divide-y divide-outline-variant">
        {issues.map((issue, index) => {
          const tone = toneByKind[issue.kind];
          const { title, detail, link, onClick } = describeIssue(issue);
          const body = (
            <>
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", issueIconClass[tone])}>
                <Icon name={issueIcon[tone]} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body-lg text-on-surface">{title}</span>
                {detail && <span className="block text-body-md text-on-surface-variant">{detail}</span>}
              </span>
              <Icon name="chevron_right" size={22} className="shrink-0 text-on-surface-variant" />
            </>
          );
          return (
            <li key={`${issue.kind}-${index}`}>
              {link ? (
                <Link {...link} className={rowClass}>
                  {body}
                </Link>
              ) : (
                <button type="button" onClick={onClick} className={rowClass}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

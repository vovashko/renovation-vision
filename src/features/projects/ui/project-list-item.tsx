import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemHeader, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { budgetSummary } from "@/domain/budget";
import { useFormat, useScheduleLabel } from "@/i18n";
import type { ProjectSummary } from "@/lib/database.types";
import { useProjectStatusLabel } from "../hooks";

/** One row of the manager's project list, linking to that project's overview. */
export function ProjectListItem({ project }: { project: ProjectSummary }) {
  const { t } = useTranslation(["projects"]);
  const format = useFormat();
  const scheduleLabel = useScheduleLabel();
  const projectStatusLabel = useProjectStatusLabel();
  const budget = budgetSummary(project);
  const behind = project.schedule_status !== "on_schedule";
  const targetDate = format.date(project.target_date, "long");
  return (
    <Item asChild size="lg" attention={behind || budget.over}>
      <Link to="/projects/$projectId" params={{ projectId: project.id }}>
        <ItemHeader>
          <ItemContent>
            <ItemTitle size="lg" className="truncate">
              {project.name}
            </ItemTitle>
            <ItemDescription className="line-clamp-none">{project.address}</ItemDescription>
          </ItemContent>
          <ItemActions className="flex-wrap justify-end">
            {/* "Active" is the normal case: only the other lifecycle states get a badge. */}
            {project.status !== "active" && (
              <Badge variant="outline" size="compact">
                {projectStatusLabel(project.status)}
              </Badge>
            )}
            {behind && (
              <Badge variant="attention" size="compact" icon="schedule">
                {scheduleLabel(project.schedule_status)}
              </Badge>
            )}
            {budget.over && (
              <Badge variant="attention" size="compact" icon="euro">
                {t("list.overBudget")}
              </Badge>
            )}
          </ItemActions>
        </ItemHeader>
        <div className="mt-5 flex w-full items-end justify-between text-body-md">
          <span className="text-on-surface-variant">
            {project.current_stage ? t("list.now", { stage: project.current_stage }) : t("list.overallProgress")}
          </span>
          <span className="text-title-md tabular-nums">{project.overall_progress}%</span>
        </div>
        <Progress value={project.overall_progress} className="mt-2" />
        <div className="mt-4 flex w-full flex-wrap gap-x-4 gap-y-1 text-body-sm text-on-surface-variant">
          <span>
            {t("list.client")} <span className="text-on-surface">{project.client_display_name || "—"}</span>
          </span>
          <span>
            {t("list.target")} <span className="text-on-surface">{targetDate}</span>
          </span>
          <span>
            {t("list.spent")}{" "}
            <span className="text-on-surface">
              {format.money(project.spent, project.currency)} / {format.money(project.budget, project.currency)}
            </span>
          </span>
        </div>
      </Link>
    </Item>
  );
}

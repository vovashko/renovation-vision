import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemHeader, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { budgetSummary } from "@/lib/budget";
import { longDate, money, scheduleLabel } from "@/lib/format";
import type { ProjectSummary } from "@/lib/database.types";

/** One row of the manager's project list, linking to that project's overview. */
export function ProjectListItem({ project }: { project: ProjectSummary }) {
  const budget = budgetSummary(project);
  return (
    <Item asChild size="lg">
      <Link to="/projects/$projectId" params={{ projectId: project.id }}>
        <ItemHeader>
          <ItemContent>
            <ItemTitle className="truncate text-title-lg">{project.name}</ItemTitle>
            <ItemDescription className="line-clamp-none">{project.address}</ItemDescription>
          </ItemContent>
          <ItemActions className="flex-wrap justify-end">
            {project.schedule_status !== "on_schedule" && (
              <Badge variant="attention" size="compact" icon="schedule">
                {scheduleLabel[project.schedule_status]}
              </Badge>
            )}
            {budget.over && (
              <Badge variant="attention" size="compact" icon="euro">
                Over budget
              </Badge>
            )}
          </ItemActions>
        </ItemHeader>
        <div className="mt-5 flex w-full items-end justify-between text-body-md">
          <span className="text-on-surface-variant">{project.current_stage ? `Now: ${project.current_stage}` : "Overall progress"}</span>
          <span className="text-title-md tabular-nums">{project.overall_progress}%</span>
        </div>
        <Progress value={project.overall_progress} className="mt-2" />
        <div className="mt-4 flex w-full flex-wrap gap-x-4 gap-y-1 text-body-sm text-on-surface-variant">
          <span>
            Client <span className="text-on-surface">{project.client_name || "—"}</span>
          </span>
          <span>
            Target <span className="text-on-surface">{longDate(project.target_date)}</span>
          </span>
          <span>
            Spent{" "}
            <span className="text-on-surface">
              {money(project.spent)} / {money(project.budget)}
            </span>
          </span>
        </div>
      </Link>
    </Item>
  );
}

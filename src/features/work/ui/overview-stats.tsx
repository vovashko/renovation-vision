import { Stat, StatChange, StatDelta, StatLabel, StatValue } from "@/components/ui/stat";
import { budgetStatus, daysLate } from "@/lib/attention";
import { longDate, money } from "@/lib/format";
import type { ProjectSummary, Stage } from "@/lib/database.types";

/** The four project-facts stat cards on the client overview. */
export function OverviewStats({ project, stages }: { project: ProjectSummary; stages: Stage[] }) {
  const budget = budgetStatus(project);
  const lateStages = stages.filter((s) => daysLate(s) > 0).length;

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Project facts">
      <Stat>
        <StatLabel>Started</StatLabel>
        <StatValue>{longDate(project.start_date)}</StatValue>
        <StatChange>Target: {longDate(project.target_date)}</StatChange>
      </Stat>
      <Stat>
        <StatLabel>Stages done</StatLabel>
        <StatValue unit={`/ ${project.stages_total}`}>{project.stages_done}</StatValue>
        <StatChange>
          <StatDelta tone={lateStages ? "attention" : "good"}>
            {lateStages ? `${lateStages} ${lateStages === 1 ? "stage" : "stages"} late` : "On schedule"}
          </StatDelta>
        </StatChange>
      </Stat>
      <Stat variant={budget.over ? "attention" : "default"}>
        <StatLabel>Budget spent</StatLabel>
        <StatValue>{money(project.spent)}</StatValue>
        <StatChange>
          <StatDelta tone={budget.over ? "attention" : "good"}>
            {budget.over ? `↑ ${budget.overPct}% over` : `${budget.usedPct}% used`}
          </StatDelta>
          of the {money(project.budget)} plan
        </StatChange>
      </Stat>
      <Stat>
        <StatLabel>Site manager</StatLabel>
        <StatValue>{project.manager_name || "—"}</StatValue>
        <StatChange>Your point of contact</StatChange>
      </Stat>
    </section>
  );
}

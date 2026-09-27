import { Icon } from "@/components/ui/icon";
import { Stat, StatChange, StatDelta, StatLabel, StatValue } from "@/components/ui/stat";
import { money } from "@/lib/format";
import type { budgetSummary } from "@/lib/budget";
import type { ProjectSummary } from "@/lib/database.types";

/** The Budget page's four stat tiles: Budget, Spent (attention over budget), Remaining, Used. */
export function BudgetStats({ project, budget }: { project: ProjectSummary; budget: ReturnType<typeof budgetSummary> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat>
        <StatLabel>
          <Icon name="euro" size={20} /> Budget
        </StatLabel>
        <StatValue>{money(project.budget)}</StatValue>
        <StatChange>Client sees this</StatChange>
      </Stat>
      <Stat variant={budget.over ? "attention" : "default"}>
        <StatLabel>
          <Icon name="account_balance_wallet" size={20} /> Spent
        </StatLabel>
        <StatValue>{money(project.spent)}</StatValue>
        <StatChange>{budget.over ? <StatDelta tone="attention">↑ {budget.overPct}% over</StatDelta> : "Client sees this total"}</StatChange>
      </Stat>
      <Stat>
        <StatLabel>
          <Icon name="savings" size={20} /> Remaining
        </StatLabel>
        <StatValue>{money(budget.remaining)}</StatValue>
        <StatChange>{budget.over ? <StatDelta tone="attention">Over budget</StatDelta> : "Left to spend"}</StatChange>
      </Stat>
      <Stat>
        <StatLabel>
          <Icon name="trending_up" size={20} /> Used
        </StatLabel>
        <StatValue>{budget.usedPct}%</StatValue>
        <StatChange>Project {project.overall_progress}% complete</StatChange>
      </Stat>
    </div>
  );
}

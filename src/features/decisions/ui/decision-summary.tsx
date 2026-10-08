import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Stat, StatChange, StatLabel, StatValue } from "@/components/ui/stat";
import type { Decision } from "@/lib/database.types";
import { pendingCount, questionCount } from "../domain/status";

/**
 * The counters at the top of the list. The first tile is the number of cases 'Oczekuje na decyzję'; a manager also
 * sees the questions waiting for an answer.
 */
export function DecisionSummary({ decisions, isManager }: { decisions: Decision[]; isManager: boolean }) {
  const { t } = useTranslation(["decisions"]);
  const pending = pendingCount(decisions);
  const questions = questionCount(decisions);
  const accepted = decisions.filter((d) => d.status === "accepted").length;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat variant={pending > 0 && !isManager ? "attention" : "default"}>
        <StatLabel>
          <Icon name="pending_actions" size={20} /> {t("decisions:summary.pending")}
        </StatLabel>
        <StatValue>{pending}</StatValue>
        <StatChange>{isManager ? t("decisions:summary.pendingHint") : t("decisions:summary.pendingHintClient")}</StatChange>
      </Stat>
      {isManager && (
        <Stat variant={questions > 0 ? "attention" : "default"}>
          <StatLabel>
            <Icon name="help" size={20} /> {t("decisions:summary.questions")}
          </StatLabel>
          <StatValue>{questions}</StatValue>
          <StatChange>{t("decisions:summary.questionsHint")}</StatChange>
        </Stat>
      )}
      <Stat>
        <StatLabel>
          <Icon name="task_alt" size={20} /> {t("decisions:summary.accepted")}
        </StatLabel>
        <StatValue>{accepted}</StatValue>
      </Stat>
    </div>
  );
}

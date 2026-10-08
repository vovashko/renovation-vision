import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { Decision } from "@/lib/database.types";
import { canAnswer, canEdit } from "../domain/status";
import { useAnswerQuestion } from "../hooks";
import { TextDialog } from "./text-dialog";

/**
 * What the site manager can do with a case: edit it while it is open, answer the investor's question in the
 * same case. (A decided case is locked: submit a new one.)
 */
export function ManagerActions({
  projectId,
  decision,
  lastQuestion,
  onEdit,
}: {
  projectId: string;
  decision: Decision;
  /** The investor's latest question, quoted above the answer field. */
  lastQuestion?: string;
  onEdit: () => void;
}) {
  const { t } = useTranslation(["decisions"]);
  const answer = useAnswerQuestion(projectId);
  const [answering, setAnswering] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canAnswer(decision.status) && (
          <Button onClick={() => setAnswering(true)} className="gap-2">
            <Icon name="reply" size={20} /> {t("decisions:actions.answer")}
          </Button>
        )}
        {canEdit(decision.status) && (
          <Button variant="outline" onClick={onEdit} className="gap-2">
            <Icon name="edit" size={20} /> {t("decisions:actions.edit")}
          </Button>
        )}
      </div>
      <TextDialog
        open={answering}
        onOpenChange={setAnswering}
        title={t("decisions:message.answerTitle")}
        description={t("decisions:message.answerDescription")}
        label={t("decisions:message.answerLabel")}
        submitLabel={t("decisions:actions.send")}
        quote={lastQuestion}
        pending={answer.isPending}
        onSubmit={(text) => answer.mutate({ decisionId: decision.id, text }, { onSuccess: () => setAnswering(false) })}
      />
    </>
  );
}

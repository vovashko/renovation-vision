import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { InternalBadge } from "@/shared/ui/visibility-badge";
import { useInternalNotes, useUpdateInternalNotes } from "../hooks/use-internal-notes";

/** Manager-only notes on the Budget page — margins, quotes, contingency — never shown to the client. */
export function InternalNotes({ projectId }: { projectId: string }) {
  const { t } = useTranslation(["budget", "common"]);
  const { data } = useInternalNotes(projectId);
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (data) setNotes(data.internal_budget_notes);
  }, [data]);
  const save = useUpdateInternalNotes(projectId);

  return (
    <Card className="border-dashed p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel htmlFor="internal-notes" className="text-title-md">
          {t("budget:internalNotes.title")}
        </FieldLabel>
        <InternalBadge />
      </div>
      <Field className="mt-3">
        <Textarea
          id="internal-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-28"
          placeholder={t("budget:internalNotes.placeholder")}
        />
      </Field>
      <div className="mt-3 flex justify-end">
        <Button variant="outline" disabled={save.isPending || notes === data?.internal_budget_notes} onClick={() => save.mutate(notes)}>
          {save.isPending ? t("common:state.saving") : t("budget:internalNotes.save")}
        </Button>
      </div>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { InternalBadge } from "@/components/manager/visibility-badge";
import { api } from "@/lib/api";
import { keys, useInternal, useSave } from "@/lib/queries";

/** Manager-only notes on the Budget page — margins, quotes, contingency — never shown to the client. */
export function InternalNotes({ projectId }: { projectId: string }) {
  const { data } = useInternal(projectId);
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (data) setNotes(data.internal_budget_notes);
  }, [data]);
  const save = useSave(projectId, (n: string) => api.updateInternal(projectId, n), {
    invalidate: [keys.internal(projectId)],
    success: "Internal notes saved",
  });
  return (
    <Card className="border-dashed p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel htmlFor="internal-notes" className="text-title-md">
          Internal budget notes
        </FieldLabel>
        <InternalBadge />
      </div>
      <Field className="mt-3">
        <Textarea
          id="internal-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-28"
          placeholder="Contingency, quotes, margins…"
        />
      </Field>
      <div className="mt-3 flex justify-end">
        <Button variant="outline" disabled={save.isPending || notes === data?.internal_budget_notes} onClick={() => save.mutate(notes)}>
          Save notes
        </Button>
      </div>
    </Card>
  );
}

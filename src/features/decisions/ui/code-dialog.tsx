import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Note } from "@/components/ui/note";
import { CodeInput } from "@/features/auth/ui/code-input";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { codeSchema } from "../domain/schemas";
import { useAcceptDecision } from "../hooks";

type Failure = "invalid_code" | "expired" | "too_many_attempts" | "no_code" | "not_open" | "already_accepted";

/**
 * Step two of accepting: the 6-digit code from the email. The database checks it (10 minutes, 5 attempts, single
 * use) and applies the budget and end date in the same transaction; this dialog only shows the outcome.
 */
export function CodeDialog({
  open,
  onOpenChange,
  projectId,
  decisionId,
  resend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  decisionId: string;
  /** Asking for a new code: the click handler, whether it is running and the seconds left of the cooldown. */
  resend: { onResend: () => void; pending: boolean; remaining: number };
}) {
  const { t } = useTranslation(["decisions", "common"]);
  const accept = useAcceptDecision(projectId);
  const form = useZodForm(codeSchema, { code: "" });
  const [failure, setFailure] = useState<Failure | null>(null);

  useEffect(() => {
    if (!open) {
      form.reset({ code: "" });
      setFailure(null);
    }
    // Reset when the dialog closes, not on every form change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = form.handleSubmit((values) => {
    setFailure(null);
    accept.mutate(
      { decisionId, code: values.code },
      {
        onSuccess: ({ result }) => {
          if (result === "ok" || result === "already_accepted") {
            onOpenChange(false);
            return;
          }
          setFailure(result);
          form.reset({ code: "" });
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("decisions:accept.codeTitle")}</DialogTitle>
          <DialogDescription>{t("decisions:accept.codeDescription")}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <FormField control={form.control} name="code" label={t("decisions:accept.codeLabel")}>
            {(field) => <CodeInput autoFocus {...field} onComplete={() => void submit()} />}
          </FormField>
          {failure && (
            <Note tone="error" size="sm">
              {t(`decisions:accept.result.${failure}`)}
            </Note>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={resend.pending || resend.remaining > 0} onClick={resend.onResend}>
              {resend.remaining > 0 ? t("decisions:accept.resendIn", { seconds: resend.remaining }) : t("decisions:accept.resend")}
            </Button>
            <Button type="submit" disabled={accept.isPending}>
              {accept.isPending ? t("decisions:accept.submitting") : t("decisions:accept.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

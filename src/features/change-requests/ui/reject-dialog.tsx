import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { rejectSchema } from "../domain/schemas";

/** The client's reason for rejecting a request (required; the manager is notified and can reopen it). */
export function RejectDialog({
  open,
  onOpenChange,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onSubmit: (reason: string) => void;
}) {
  const { t } = useTranslation(["change-requests", "common"]);
  const form = useZodForm(rejectSchema, { text: "" });
  useEffect(() => {
    if (!open) form.reset({ text: "" });
    // Reset when the dialog closes, not on every form change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("change-requests:reject.title")}</DialogTitle>
          <DialogDescription>{t("change-requests:reject.description")}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={form.handleSubmit((values) => onSubmit(values.text))} className="flex flex-col gap-4">
          <FormField control={form.control} name="text" label={t("change-requests:reject.label")}>
            {(field) => <Textarea {...field} rows={5} />}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {t("change-requests:reject.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

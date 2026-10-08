import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { messageSchema } from "../domain/schemas";

/**
 * One dialog for the three free-text steps of a case: the investor's question, the manager's answer and the
 * investor's reason for rejecting. `schema` decides what is required (a reason has its own message).
 */
export function TextDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  submitLabel,
  schema = messageSchema,
  pending,
  quote,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  submitLabel: string;
  schema?: typeof messageSchema;
  pending: boolean;
  /** Text shown above the field (the question being answered). */
  quote?: string;
  onSubmit: (text: string) => void;
}) {
  const { t } = useTranslation(["common"]);
  const form = useZodForm(schema, { text: "" });
  useEffect(() => {
    if (!open) form.reset({ text: "" });
    // Reset when the dialog closes, not on every form change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={form.handleSubmit((values) => onSubmit(values.text))} className="flex flex-col gap-4">
          {quote && <blockquote className="border-l-2 border-outline pl-3 text-body-md text-on-surface-variant">{quote}</blockquote>}
          <FormField control={form.control} name="text" label={label}>
            {(field) => <Textarea {...field} rows={5} />}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
